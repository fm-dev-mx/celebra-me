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
export const CANONICAL_STATUS_TIMEOUT_MS = 30_000;
export const CANONICAL_STATUS_MAX_STDOUT_BYTES = 1024 * 1024;

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

function runStatusChild(args: string[], timeoutMs: number): Promise<unknown> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, ['--import', 'tsx', STATUS_SCRIPT, ...args], {
			cwd: process.cwd(),
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		let stdout = '';
		let settled = false;
		let stdoutTruncated = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill('SIGTERM');
			reject(
				new ApiError(
					504,
					'service_unavailable',
					'La consulta de estado excedió el tiempo límite.',
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
		child.stderr.resume();

		child.on('error', () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(
				new ApiError(500, 'internal_error', 'No se pudo iniciar la consulta de estado.'),
			);
		});

		child.on('close', (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (stdoutTruncated) {
				reject(
					new ApiError(
						500,
						'internal_error',
						'La consulta de estado excedió el tamaño máximo de salida.',
					),
				);
				return;
			}
			if (code !== 0) {
				reject(
					new ApiError(500, 'internal_error', 'La consulta de estado falló de forma controlada.', {
						exitCode: code ?? -1,
					}),
				);
				return;
			}
			try {
				const parsed: unknown = JSON.parse(stdout);
				resolvePromise(parsed);
			} catch {
				reject(
					new ApiError(
						500,
						'internal_error',
						'La consulta de estado devolvió un resultado inválido.',
					),
				);
			}
		});
	});
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
}

function cacheLooksSecret(serialized: string): boolean {
	return /postgres(ql)?:\/\//i.test(serialized) || /service_role/i.test(serialized);
}

function isPersistableView(view: CanonicalStatusView): boolean {
	return ENVS.some((env) => hasPersistableOperationalEvidence(view.environments[env].evidence));
}

function asHydratedCache(view: CanonicalStatusView, nowMs: number = Date.now()): CanonicalStatusView {
	const lastVerifiedAt = view.freshnessMeta?.lastVerifiedAt ?? view.generatedAt;
	return {
		...view,
		evidence: view.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
		freshnessMeta: freshnessFromCachedTimestamp(lastVerifiedAt, nowMs),
		environments: {
			local: {
				...view.environments.local,
				evidence: view.environments.local.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
			},
			preview: {
				...view.environments.preview,
				evidence: view.environments.preview.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
			},
			production: {
				...view.environments.production,
				evidence:
					view.environments.production.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
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
			console.warn('[canonical-status] Refusing to persist a status payload that looks secret.');
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

export async function readCanonicalStatusLocal(): Promise<CanonicalStatusView> {
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
	domain?: 'schema' | 'content';
	diagnostics?: boolean;
}): Promise<CanonicalStatusView> {
	return await withLock(async () => {
		const args = [
			...(options?.env ? [`--env=${options.env}`] : []),
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
}
