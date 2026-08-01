/**
 * Server-only snapshot builder wrapper.
 * Isolates scripts/ Node imports from client islands and runs aggregation in a
 * child process so synchronous probes cannot stall the Astro/Vite event loop.
 *
 * Concurrency: at most one aggregation at a time (queue). Detail responses are
 * Zod-validated and cached for 60s with stale-fallback. Summary is Local-scoped.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ApiError } from '@/lib/rsvp/core/errors';
import type { ObservabilitySnapshot, ObservabilitySummaryPayload } from '@/lib/observability/types';
import { ObservabilitySnapshotSchema } from '@/lib/observability/schema';
import { createObservabilitySnapshotCache } from './snapshot-cache';

const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/observability/print-snapshot.ts');
const SUMMARY_TIMEOUT_MS = 60_000;
const DETAIL_TIMEOUT_MS = 300_000;
const MAX_STDOUT_BYTES = 1024 * 1024;

type QueueJob<T> = {
	run: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
};

const queue: QueueJob<unknown>[] = [];
let busy = false;

async function withAggregationLock<T>(run: () => Promise<T>): Promise<T> {
	return await new Promise<T>((resolvePromise, rejectPromise) => {
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
		const value = await next.run();
		next.resolve(value);
	} catch (error) {
		next.reject(error);
	} finally {
		busy = false;
		void drainQueue();
	}
}

function runSnapshotChild(options: {
	mode: 'summary' | 'detail';
	timeoutMs: number;
}): Promise<unknown> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(
			process.execPath,
			['--import', 'tsx', SNAPSHOT_SCRIPT, `--mode=${options.mode}`],
			{
				cwd: process.cwd(),
				env: process.env,
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
			},
		);

		let stdout = '';
		let stderr = '';
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
					'La agregación de observabilidad excedió el tiempo límite.',
				),
			);
		}, options.timeoutMs);

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			if (stdoutTruncated) return;
			if (stdout.length + chunk.length > MAX_STDOUT_BYTES) {
				stdoutTruncated = true;
				stdout = stdout.slice(0, MAX_STDOUT_BYTES);
				return;
			}
			stdout += chunk;
		});
		child.stderr.on('data', (chunk: string) => {
			stderr += chunk;
			if (stderr.length > 4_000) stderr = stderr.slice(-4_000);
		});

		child.on('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(
				new ApiError(
					500,
					'internal_error',
					'No se pudo iniciar la agregación de observabilidad.',
					{ reason: error.message.slice(0, 120) },
				),
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
						'La agregación de observabilidad excedió el tamaño máximo de salida.',
					),
				);
				return;
			}

			if (code !== 0) {
				reject(
					new ApiError(
						500,
						'internal_error',
						'La agregación de observabilidad falló de forma controlada.',
						{ exitCode: code ?? -1 },
					),
				);
				return;
			}

			try {
				const parsed: unknown = JSON.parse(stdout);
				if (!parsed || typeof parsed !== 'object') {
					throw new Error('invalid_snapshot_shape');
				}
				resolvePromise(parsed);
			} catch {
				reject(
					new ApiError(
						500,
						'internal_error',
						'La agregación de observabilidad devolvió un resultado inválido.',
					),
				);
			}
		});
	});
}

async function buildUncachedObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
	const parsed = await runSnapshotChild({
		mode: 'detail',
		timeoutMs: DETAIL_TIMEOUT_MS,
	});
	return ObservabilitySnapshotSchema.parse(parsed);
}

const snapshotCache = createObservabilitySnapshotCache({
	build: () => withAggregationLock(() => buildUncachedObservabilitySnapshot()),
});

export async function buildObservabilitySummaryPayload(): Promise<ObservabilitySummaryPayload> {
	return await withAggregationLock(async () => {
		const parsed = await runSnapshotChild({
			mode: 'summary',
			timeoutMs: SUMMARY_TIMEOUT_MS,
		});
		const candidate = parsed as ObservabilitySummaryPayload;
		if (
			!candidate ||
			typeof candidate !== 'object' ||
			candidate.schemaVersion !== 1 ||
			typeof candidate.generatedAt !== 'string' ||
			!candidate.summary
		) {
			throw new ApiError(
				500,
				'internal_error',
				'La agregación de observabilidad devolvió un resultado inválido.',
			);
		}
		return candidate;
	});
}

export async function buildObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
	return await snapshotCache.get();
}
