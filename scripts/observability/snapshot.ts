/**
 * Aggregated Local-first observability snapshot (read-only).
 *
 * `probeScope: 'local'` (summary): Local DB + FS evidence only — no Preview/Production hits.
 * `probeScope: 'all'` (detail): full multi-environment matrix.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
	EXPECTED_LOCAL_RENDER_CORPUS_SIZE,
	listLocalRenderCorpus,
} from '../provision/local-render-corpus/registry.ts';
import { MANAGED_STATUS_PER_QUERY_TIMEOUT_MS } from '../provision/managed-status.ts';
import { evaluateGeneralStatus, type TargetEnv } from '../provision/dbs-status.ts';
import { evaluateAssetHealth } from './asset-health.ts';
import { buildEnvironmentHealth } from './environment-health.ts';
import { computeObservabilityFingerprints } from './fingerprints.ts';
import { evaluateInvitationHealth } from './invitation-health.ts';
import { evaluateMigrationHealth } from './migration-health.ts';
import { computeOverallStatus } from './overall-status.ts';
import { buildRecommendedCommands } from './recommended-commands.ts';
import { readObservabilitySourceState } from './source-state.ts';
import {
	classifyValidationFreshness,
	readValidationEvidenceSnapshot,
	validationEvidenceAbsolutePath,
} from './validation-evidence.ts';
import type {
	CommandCategory,
	ObservabilityFingerprints,
	ObservabilitySnapshot,
	ObservabilitySourceState,
	ObservabilitySummaryPayload,
	ValidationEvidenceType,
	ValidationEvidenceView,
} from './types.ts';

export type ObservabilityProbeScope = 'local' | 'all';

function viewEvidence(
	type: ValidationEvidenceType,
	fingerprints: ObservabilityFingerprints,
	source: ObservabilitySourceState,
): ValidationEvidenceView {
	const snapshot = readValidationEvidenceSnapshot(type);
	if (snapshot) {
		return {
			validationType: type,
			freshness: classifyValidationFreshness(snapshot, fingerprints, source),
			snapshot,
		};
	}

	const abs = validationEvidenceAbsolutePath(type);
	if (!existsSync(abs)) {
		return { validationType: type, freshness: 'NOT_RUN', snapshot: null };
	}

	try {
		JSON.parse(readFileSync(abs, 'utf8'));
		return {
			validationType: type,
			freshness: 'INVALID',
			snapshot: null,
			detail: 'Snapshot present but unsupported or incomplete',
		};
	} catch {
		return {
			validationType: type,
			freshness: 'INVALID',
			snapshot: null,
			detail: 'Snapshot file malformed',
		};
	}
}

function probeEnvironmentsForScope(scope: ObservabilityProbeScope): readonly TargetEnv[] {
	return scope === 'local' ? (['local'] as const) : (['local', 'preview', 'production'] as const);
}

export function categorizeCommand(id: string): CommandCategory {
	if (id.includes('dbs') || id.includes('status')) return 'DIAGNOSE';
	if (
		id.includes('test') ||
		id.includes('screenshot') ||
		id.includes('regression') ||
		id.includes('validate')
	) {
		return 'VALIDATE';
	}
	if (id.includes('promote')) return 'PROMOTE';
	return 'REPAIR';
}

export async function buildObservabilitySnapshot(options?: {
	probeTimeoutMs?: number;
	probeScope?: ObservabilityProbeScope;
}): Promise<ObservabilitySnapshot> {
	const probeTimeoutMs = options?.probeTimeoutMs ?? MANAGED_STATUS_PER_QUERY_TIMEOUT_MS;
	const probeScope: ObservabilityProbeScope = options?.probeScope ?? 'all';
	const probeEnvs = probeEnvironmentsForScope(probeScope);
	const degradedNotes: string[] = [];
	const generatedAt = new Date().toISOString();
	const source = readObservabilitySourceState();
	if (source.degraded) {
		degradedNotes.push(source.detail ?? 'Git source identity degraded');
	}
	if (probeScope === 'local') {
		degradedNotes.push(
			'Summary scope: Local probes only (Preview/Production deferred to detail)',
		);
	}

	const fingerprints = computeObservabilityFingerprints();
	const corpus = listLocalRenderCorpus();
	const corpusComplete = corpus.length === EXPECTED_LOCAL_RENDER_CORPUS_SIZE;

	if (!corpusComplete) {
		degradedNotes.push(
			`Corpus size ${corpus.length} !== expected ${EXPECTED_LOCAL_RENDER_CORPUS_SIZE}`,
		);
	}

	let invitations = [] as Awaited<ReturnType<typeof evaluateInvitationHealth>>;
	let migrations = [] as ReturnType<typeof evaluateMigrationHealth>;
	let generalStatus: ReturnType<typeof evaluateGeneralStatus> | undefined;

	const [invitationResult, generalResult] = await Promise.all([
		(async () => {
			try {
				return {
					ok: true as const,
					value: await evaluateInvitationHealth({
						probeTimeoutMs,
						environments: probeEnvs,
					}),
				};
			} catch (error) {
				return {
					ok: false as const,
					error: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
				};
			}
		})(),
		(async () => {
			try {
				return {
					ok: true as const,
					value: evaluateGeneralStatus({ environments: probeEnvs }),
				};
			} catch (error) {
				return {
					ok: false as const,
					error: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
				};
			}
		})(),
	]);

	if (invitationResult.ok) {
		invitations = invitationResult.value;
	} else {
		degradedNotes.push(`Invitation matrix degraded: ${invitationResult.error}`);
	}

	if (generalResult.ok) {
		generalStatus = generalResult.value;
		try {
			migrations = evaluateMigrationHealth(generalStatus, { environments: probeEnvs });
		} catch (error) {
			degradedNotes.push(
				`Migration health degraded: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`,
			);
		}
	} else {
		degradedNotes.push(`Environment/migration probes degraded: ${generalResult.error}`);
		try {
			migrations = evaluateMigrationHealth(undefined, { environments: probeEnvs });
		} catch (error) {
			degradedNotes.push(
				`Migration health degraded: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`,
			);
		}
	}

	const dbAssetCountBySlug = new Map<string, number | null>();
	for (const row of invitations) {
		dbAssetCountBySlug.set(row.slug, row.environments.local.assetCount);
	}

	let assets = [] as ReturnType<typeof evaluateAssetHealth>;
	try {
		assets = evaluateAssetHealth(dbAssetCountBySlug);
	} catch (error) {
		degradedNotes.push(
			`Asset health degraded: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`,
		);
	}

	let environments = [] as ReturnType<typeof buildEnvironmentHealth>;
	try {
		environments = buildEnvironmentHealth({
			invitations,
			probeTimeoutMs,
			generalStatus,
			environments: probeEnvs,
		});
	} catch (error) {
		degradedNotes.push(
			`Environment matrix degraded: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`,
		);
	}

	const regression = viewEvidence('regression', fingerprints, source);
	const screenshots = viewEvidence('screenshots', fingerprints, source);

	const overallStatus = computeOverallStatus({
		environments,
		invitations,
		migrations,
		assets,
		regression,
		screenshots,
		corpusComplete,
	});

	const recommendedCommands = buildRecommendedCommands({
		overallStatus,
		environments,
		invitations,
		migrations,
		assets,
		regression,
		screenshots,
	});

	return {
		schemaVersion: 1,
		generatedAt,
		overallStatus,
		source,
		fingerprints,
		validation: { regression, screenshots },
		migrations,
		assets,
		invitations,
		environments,
		recommendedCommands,
		degradedNotes,
	};
}

function projectSnapshotToSummary(snapshot: ObservabilitySnapshot): ObservabilitySummaryPayload {
	const alignedCount = snapshot.invitations.filter(
		(i) =>
			i.environments.local.status === 'MATCH_CANONICAL' ||
			i.environments.local.status === 'MATCH_REFERENCE',
	).length;
	const divergedCount = snapshot.invitations.filter(
		(i) =>
			i.environments.local.status === 'DIVERGED' ||
			i.environments.local.status === 'DIVERGED_FROM_REFERENCE',
	).length;
	const behindCount = snapshot.invitations.filter(
		(i) => i.environments.local.status === 'BEHIND_CANONICAL',
	).length;
	const issueSlugs = snapshot.invitations
		.filter(
			(i) =>
				i.environments.local.status !== 'MATCH_CANONICAL' &&
				i.environments.local.status !== 'MATCH_REFERENCE',
		)
		.map((i) => i.slug);

	const localMigration = snapshot.migrations.find((m) => m.environment === 'local');
	const pendingCount = Array.isArray(localMigration?.pending) ? localMigration.pending.length : 0;

	return {
		schemaVersion: 1,
		generatedAt: snapshot.generatedAt,
		overallStatus: snapshot.overallStatus,
		source: snapshot.source,
		summary: {
			migrations: {
				hasPending: pendingCount > 0,
				pendingCount,
				localLifecycle: localMigration?.schemaLifecycle ?? 'UNVERIFIED',
			},
			invitations: {
				totalCount: snapshot.invitations.length,
				alignedCount,
				divergedCount,
				behindCount,
				issueSlugs,
			},
			validation: {
				regressionFreshness: snapshot.validation.regression.freshness,
				screenshotsFreshness: snapshot.validation.screenshots.freshness,
			},
		},
		categorizedCommands: snapshot.recommendedCommands.map((cmd) => ({
			...cmd,
			category: categorizeCommand(cmd.id),
		})),
		degradedNotes: snapshot.degradedNotes,
	};
}

/**
 * Lightweight-wire summary. Compute is Local-scoped (no Preview/Production DB probes).
 */
export async function buildObservabilitySummary(options?: {
	probeTimeoutMs?: number;
}): Promise<ObservabilitySummaryPayload> {
	const snapshot = await buildObservabilitySnapshot({
		...options,
		probeScope: 'local',
	});
	return projectSnapshotToSummary(snapshot);
}
