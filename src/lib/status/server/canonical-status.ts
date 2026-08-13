/**
 * Server-only canonical status: local-first cache, explicit remote refresh.
 * Child process keeps psql probes off the Astro event loop.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ApiError } from '@/lib/rsvp/core/errors';
import { mergeCanonicalStatusView } from '@/lib/status/merge';
import { CanonicalStatusViewSchema } from '@/lib/status/schema';
import type { CanonicalStatusView, TargetEnv } from '@/lib/status/types';

const STATUS_SCRIPT = resolve(process.cwd(), 'scripts/provision/print-canonical-status.ts');
export const CANONICAL_STATUS_TIMEOUT_MS = 30_000;
export const CANONICAL_STATUS_MAX_STDOUT_BYTES = 1024 * 1024;
export const CANONICAL_STATUS_CACHE_TTL_MS = 60_000;

type QueueJob<T> = {
	run: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
};

const queue: QueueJob<unknown>[] = [];
let busy = false;
let cache: { view: CanonicalStatusView; createdAtMs: number } | null = null;

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

import { existsSync, promises as fsPromises } from 'node:fs';

const SNAPSHOT_FILE = resolve(process.cwd(), '.agent/status-snapshot.json');

export async function readDurableStatusSnapshot(): Promise<CanonicalStatusView | null> {
	try {
		if (!existsSync(SNAPSHOT_FILE)) return null;
		const raw = await fsPromises.readFile(SNAPSHOT_FILE, 'utf8');
		const parsed: unknown = JSON.parse(raw);
		return CanonicalStatusViewSchema.parse(parsed);
	} catch {
		return null;
	}
}

export async function writeDurableStatusSnapshot(view: CanonicalStatusView): Promise<void> {
	try {
		const dir = resolve(process.cwd(), '.agent');
		if (!existsSync(dir)) {
			await fsPromises.mkdir(dir, { recursive: true });
		}
		await fsPromises.writeFile(SNAPSHOT_FILE, JSON.stringify(view, null, 2), 'utf8');
	} catch (error) {
		console.warn('[canonical-status] Unable to write durable snapshot:', error);
	}
}

function labelCached(
	view: CanonicalStatusView,
	freshnessStatus: 'LIVE' | 'CACHED' | 'STALE' | 'REVALIDATING' | 'UNVERIFIED' = 'CACHED',
): CanonicalStatusView {
	return {
		...view,
		evidence: view.evidence === 'UNVERIFIED' ? 'UNVERIFIED' : 'CACHED',
		freshnessMeta: {
			status: freshnessStatus,
			lastVerifiedAt: view.generatedAt,
		},
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

export async function readCanonicalStatusLocal(): Promise<CanonicalStatusView> {
	const parsed = await runStatusChild(['--local'], 8_000);
	return CanonicalStatusViewSchema.parse(parsed);
}

export async function getCanonicalStatusView(): Promise<CanonicalStatusView> {
	if (cache) {
		const ageMs = Date.now() - cache.createdAtMs;
		const freshnessStatus = ageMs < CANONICAL_STATUS_CACHE_TTL_MS ? 'LIVE' : 'STALE';
		return labelCached(cache.view, freshnessStatus);
	}

	const durable = await readDurableStatusSnapshot();
	if (durable) {
		const ageMs = Date.now() - new Date(durable.generatedAt).getTime();
		const freshnessStatus = ageMs < CANONICAL_STATUS_CACHE_TTL_MS ? 'LIVE' : 'STALE';
		cache = { view: durable, createdAtMs: new Date(durable.generatedAt).getTime() };
		return labelCached(durable, freshnessStatus);
	}

	const initial = await readCanonicalStatusLocal();
	cache = { view: initial, createdAtMs: Date.now() };
	void writeDurableStatusSnapshot(initial);
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
		const previousSnapshot = cache?.view ?? (await readDurableStatusSnapshot());
		const merged = mergeCanonicalStatusView({
			previous: previousSnapshot,
			incoming,
			env: options?.env,
			domain: options?.domain,
		});
		cache = { view: merged, createdAtMs: Date.now() };
		await writeDurableStatusSnapshot(merged);
		return {
			...merged,
			freshnessMeta: {
				status: 'LIVE',
				lastVerifiedAt: merged.generatedAt,
			},
		};
	});
}
