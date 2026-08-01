/**
 * Server-only snapshot builder wrapper.
 * Isolates scripts/ Node imports from client islands and runs aggregation in a
 * child process so synchronous probes cannot stall the Astro/Vite event loop.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ApiError } from '@/lib/rsvp/core/errors';
import type { ObservabilitySnapshot } from '@/lib/observability/types';
import { ObservabilitySnapshotSchema } from '@/lib/observability/schema';
import { createObservabilitySnapshotCache } from './snapshot-cache';

const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/observability/print-snapshot.ts');
const SNAPSHOT_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 1024 * 1024;

async function buildUncachedObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, ['--import', 'tsx', SNAPSHOT_SCRIPT], {
			cwd: process.cwd(),
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		let stdout = '';
		let stderr = '';
		let settled = false;

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
		}, SNAPSHOT_TIMEOUT_MS);

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			stdout += chunk;
			if (Buffer.byteLength(stdout, 'utf8') > MAX_STDOUT_BYTES && !settled) {
				settled = true;
				clearTimeout(timer);
				child.kill('SIGTERM');
				reject(
					new ApiError(
						502,
						'service_unavailable',
						'La agregación de observabilidad excedió el tamaño permitido.',
					),
				);
			}
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
				const parsed = ObservabilitySnapshotSchema.parse(JSON.parse(stdout));
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

const snapshotCache = createObservabilitySnapshotCache({
	build: buildUncachedObservabilitySnapshot,
});

export async function buildObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
	return await snapshotCache.get();
}
