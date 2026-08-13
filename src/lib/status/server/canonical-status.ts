/**
 * Server-only canonical status: local-first cache, explicit remote refresh.
 * Child process keeps psql probes off the Astro event loop.
 */
import { spawn } from 'node:child_process';
import { existsSync, promises as fsPromises } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	ENVS,
	freshnessFromCachedTimestamp,
	hasPersistableOperationalEvidence,
	liveFreshnessMeta,
} from '@/lib/status/evidence';
import { mergeCanonicalStatusView } from '@/lib/status/merge';
import { CanonicalStatusViewSchema } from '@/lib/status/schema';
import type { CanonicalStatusView, TargetEnv } from '@/lib/status/types';

const STATUS_SCRIPT = resolve(process.cwd(), 'scripts/provision/print-canonical-status.ts');
const CANONICAL_STATUS_TIMEOUT_MS = 120_000;
export const CANONICAL_STATUS_MAX_STDOUT_BYTES = 1024 * 1024;
const CANONICAL_STATUS_MAX_FAILURE_DETAIL_CHARS = 512;

const DEFAULT_CACHE_FILE = resolve(process.cwd(), '.cache/canonical-status.json');

type QueueJob<T> = {
	run: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
};

const queue: QueueJob<unknown>[] = [];
let busy = false;
let cache: { view: CanonicalStatusView } | null = null;
let cachePathOverride: string | null = null;
let statusChildRunnerOverride: ((args: string[], timeoutMs: number) => Promise<unknown>) | null =
	null;
const inFlightRefreshes = new Map<string, Promise<CanonicalStatusView>>();

async function withLock<T>(run: () => Promise<T>): Promise<T> {
	return await new Promise((resolvePromise, rejectPromise) => {
		queue.push({
			run: run as () => Promise<unknown>,
			resolve: resolvePromise as (value: unknown) => void,
			reject: rejectPromise,
		});
		void drainQueue();
	});
}

async function drainQueue(): Promise<void> {
	if (busy) return;
	const next = queue.shift();
	if (!next) return;
	busy = true;
	try {
		next.resolve(await next.run());
	} catch (error) {
		next.reject(error);
	} finally {
		busy = false;
		void drainQueue();
	}
}

function redactChildFailureDetail(value: string): string {
	return value
		.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '<redacted-db-url>')
		.replace(
			/\b(?:service[_-]?role|supabase[_-]?key|password|token)\s*(?:=|:)?\s*[^\s'"`]+/gi,
			'<redacted-secret>',
		)
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, CANONICAL_STATUS_MAX_FAILURE_DETAIL_CHARS);
}

function childFailure(
	status: 500 | 504,
	diagnosticCode: string,
	message: string,
	detail?: string,
): ApiError {
	return new ApiError(
		status,
		status === 504 ? 'service_unavailable' : 'internal_error',
		message,
		{
			statusProbe: {
				code: diagnosticCode,
				domain: 'schema-and-content',
				evidence: 'UNVERIFIED',
				detail: detail ? redactChildFailureDetail(detail) : undefined,
			},
		},
	);
}

export function runCanonicalStatusChild(args: string[], timeoutMs: number): Promise<unknown> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, ['--import', 'tsx', STATUS_SCRIPT, ...args], {
			cwd: process.cwd(),
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		let stdout = '';
		let stderr = '';
		let settled = false;
		let stdoutTruncated = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill('SIGTERM');
			reject(
				childFailure(
					504,
					'STATUS_PROBE_TIMEOUT',
					'La consulta de estado excedió el tiempo límite.',
					stderr,
				),
			);
		}, timeoutMs);

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			if (stdoutTruncated) return;
			if (stdout.length + chunk.length > CANONICAL_STATUS_MAX_STDOUT_BYTES) {
				stdoutTruncated = true;
				stdout = stdout.slice(0, CANONICAL_STATUS_MAX_STDOUT_BYTES);
				return;
			}
			stdout += chunk;
		});
		child.stderr.on('data', (chunk: string) => {
			if (stderr.length >= CANONICAL_STATUS_MAX_FAILURE_DETAIL_CHARS) return;
			stderr += chunk.slice(0, CANONICAL_STATUS_MAX_FAILURE_DETAIL_CHARS - stderr.length);
		});

		child.on('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(
				childFailure(
					500,
					'STATUS_PROBE_START_FAILED',
					'No se pudo iniciar la consulta de estado.',
					error instanceof Error ? error.message : String(error),
				),
			);
		});

		child.on('close', (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (stdoutTruncated) {
				reject(
					childFailure(
						500,
						'STATUS_PROBE_OUTPUT_EXCESSIVE',
						'La consulta de estado excedió el tamaño máximo de salida.',
						stdout,
					),
				);
				return;
			}
			if (code !== 0) {
				reject(
					childFailure(
						500,
						'STATUS_PROBE_EXIT_NONZERO',
						'La consulta de estado falló de forma controlada.',
						stderr || stdout,
					),
				);
				return;
			}
			try {
				const parsed: unknown = JSON.parse(stdout);
				resolvePromise(parsed);
			} catch {
				reject(
					childFailure(
						500,
						'STATUS_PROBE_INVALID_JSON',
						'La consulta de estado devolvió un resultado inválido.',
						`stdout bytes=${stdout.length}`,
					),
				);
			}
		});
	});
}

function runStatusChild(args: string[], timeoutMs: number): Promise<unknown> {
	return (statusChildRunnerOverride ?? runCanonicalStatusChild)(args, timeoutMs);
}

function operationalCachePath(): string {
	if (cachePathOverride) return cachePathOverride;
	const fromEnv = process.env.CELEBRA_STATUS_CACHE_PATH?.trim();
	if (fromEnv) return fromEnv;
	return DEFAULT_CACHE_FILE;
}

export function setOperationalStatusCachePathForTests(path: string | null): void {
	cachePathOverride = path;
}

export function resetCanonicalStatusRuntimeForTests(): void {
	cache = null;
	cachePathOverride = null;
	statusChildRunnerOverride = null;
	inFlightRefreshes.clear();
}

export function setCanonicalStatusChildRunnerForTests(
	runner: ((args: string[], timeoutMs: number) => Promise<unknown>) | null,
): void {
	statusChildRunnerOverride = runner;
}

function cacheLooksSecret(serialized: string): boolean {
	return /postgres(ql)?:\/\//i.test(serialized) || /service_role/i.test(serialized);
}

function isPersistableView(view: CanonicalStatusView): boolean {
	return ENVS.some((env) => hasPersistableOperationalEvidence(view.environments[env].evidence));
}

function asHydratedCache(
	view: CanonicalStatusView,
	nowMs: number = Date.now(),
): CanonicalStatusView {
	const lastVerifiedAt = view.freshnessMeta?.lastVerifiedAt ?? view.generatedAt;
	return {
		...view,
		evidence: view.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
		freshnessMeta: freshnessFromCachedTimestamp(lastVerifiedAt, nowMs),
		environments: {
			local: {
				...view.environments.local,
				evidence:
					view.environments.local.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
			},
			preview: {
				...view.environments.preview,
				evidence:
					view.environments.preview.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
			},
			production: {
				...view.environments.production,
				evidence:
					view.environments.production.evidence === 'UNVERIFIED'
						? 'UNVERIFIED'
						: 'CACHED',
			},
		},
		promotions: view.promotions.map((row) => ({
			...row,
			evidence: row.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
		})),
	};
}

export async function readOperationalStatusCache(): Promise<CanonicalStatusView | null> {
	try {
		const file = operationalCachePath();
		if (!existsSync(file)) return null;
		const raw = await fsPromises.readFile(file, 'utf8');
		if (cacheLooksSecret(raw)) return null;
		const parsed: unknown = JSON.parse(raw);
		return CanonicalStatusViewSchema.parse(parsed);
	} catch {
		return null;
	}
}

export async function writeOperationalStatusCache(view: CanonicalStatusView): Promise<void> {
	if (!isPersistableView(view)) return;
	try {
		const serialized = JSON.stringify(view, null, 2);
		if (cacheLooksSecret(serialized)) {
			console.warn(
				'[canonical-status] Refusing to persist a status payload that looks secret.',
			);
			return;
		}
		const file = operationalCachePath();
		const dir = dirname(file);
		if (!existsSync(dir)) {
			await fsPromises.mkdir(dir, { recursive: true });
		}
		await fsPromises.writeFile(file, serialized, 'utf8');
	} catch (error) {
		console.warn('[canonical-status] Unable to write operational cache:', error);
	}
}

async function readCanonicalStatusLocal(): Promise<CanonicalStatusView> {
	const parsed = await runStatusChild(['--local'], 8_000);
	return CanonicalStatusViewSchema.parse(parsed);
}

export async function getCanonicalStatusView(): Promise<CanonicalStatusView> {
	if (cache) {
		return asHydratedCache(cache.view);
	}

	const durable = await readOperationalStatusCache();
	if (durable) {
		cache = { view: durable };
		return asHydratedCache(durable);
	}

	const initial = await readCanonicalStatusLocal();
	cache = { view: initial };
	return initial;
}

export async function refreshCanonicalStatusView(options?: {
	env?: TargetEnv;
	domain?: 'schema' | 'content' | 'patch';
	diagnostics?: boolean;
}): Promise<CanonicalStatusView> {
	const key = JSON.stringify({
		env: options?.env ?? null,
		domain: options?.domain ?? null,
		diagnostics: Boolean(options?.diagnostics),
	});
	const existing = inFlightRefreshes.get(key);
	if (existing) return await existing;
	const refresh = withLock(async () => {
		const args = [
			...(options?.env ? [`--env=${options.env}`] : []),
			...(options?.domain ? [`--domain=${options.domain}`] : []),
			...(options?.diagnostics ? ['--diagnostics'] : []),
		];
		const parsed = await runStatusChild(args, CANONICAL_STATUS_TIMEOUT_MS);
		const incoming = CanonicalStatusViewSchema.parse(parsed);
		const previousSnapshot = cache?.view ?? (await readOperationalStatusCache());
		const merged = mergeCanonicalStatusView({
			previous: previousSnapshot,
			incoming,
			env: options?.env,
			domain: options?.domain,
		});
		cache = { view: merged };
		await writeOperationalStatusCache(merged);
		return {
			...merged,
			freshnessMeta: liveFreshnessMeta(merged.generatedAt),
		};
	});
	inFlightRefreshes.set(key, refresh);
	try {
		return await refresh;
	} finally {
		if (inFlightRefreshes.get(key) === refresh) inFlightRefreshes.delete(key);
	}
}
