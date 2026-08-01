/**
 * Server-only snapshot builder wrapper.
 * Isolates scripts/ Node imports from client islands and runs aggregation in a
 * child process so synchronous probes cannot stall the Astro/Vite event loop.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ApiError } from '@/lib/rsvp/core/errors';
import type { ObservabilitySnapshot, ObservabilitySummaryPayload } from '@/lib/observability/types';

const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/observability/print-snapshot.ts');
const SNAPSHOT_TIMEOUT_MS = 300_000;

export async function buildObservabilitySummaryPayload(options?: {
	probeTimeoutMs?: number;
}): Promise<ObservabilitySummaryPayload> {
	const probeTimeoutMs = options?.probeTimeoutMs ?? 2_000;
	try {
		const { buildObservabilitySummary } = await import('../../../../scripts/observability/snapshot.ts');
		return await buildObservabilitySummary({ probeTimeoutMs });
	} catch {
		// Fallback to full snapshot wrapper mapped to summary if direct import fails
		const full = await buildObservabilitySnapshot();
		return {
			schemaVersion: 1,
			generatedAt: full.generatedAt,
			overallStatus: full.overallStatus,
			source: full.source,
			summary: {
				migrations: {
					hasPending: (full.migrations.find((m) => m.environment === 'local')?.pending.length ?? 0) > 0,
					pendingCount: Array.isArray(full.migrations.find((m) => m.environment === 'local')?.pending)
						? (full.migrations.find((m) => m.environment === 'local')?.pending as string[]).length
						: 0,
					localLifecycle: full.migrations.find((m) => m.environment === 'local')?.schemaLifecycle ?? 'UNVERIFIED',
				},
				invitations: {
					totalCount: full.invitations.length,
					alignedCount: full.invitations.filter((i) => i.environments.local.status === 'MATCH_CANONICAL' || i.environments.local.status === 'MATCH_REFERENCE').length,
					divergedCount: full.invitations.filter((i) => i.environments.local.status === 'DIVERGED' || i.environments.local.status === 'DIVERGED_FROM_REFERENCE').length,
					behindCount: full.invitations.filter((i) => i.environments.local.status === 'BEHIND_CANONICAL').length,
					issueSlugs: full.invitations.filter((i) => i.environments.local.status !== 'MATCH_CANONICAL' && i.environments.local.status !== 'MATCH_REFERENCE').map((i) => i.slug),
				},
				validation: {
					regressionFreshness: full.validation.regression.freshness,
					screenshotsFreshness: full.validation.screenshots.freshness,
				},
			},
			categorizedCommands: full.recommendedCommands.map((cmd) => ({
				...cmd,
				category: cmd.id.includes('dbs') ? 'DIAGNOSE' : cmd.id.includes('test') ? 'VALIDATE' : cmd.id.includes('promote') ? 'PROMOTE' : 'REPAIR',
			})),
			degradedNotes: full.degradedNotes,
		};
	}
}

export async function buildObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
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
				const parsed = JSON.parse(stdout) as ObservabilitySnapshot;
				if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
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
