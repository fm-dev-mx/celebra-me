/**
 * Aggregated Local-first observability snapshot (read-only).
 */

import { existsSync, readFileSync } from 'node:fs';
import {
	EXPECTED_LOCAL_RENDER_CORPUS_SIZE,
	listLocalRenderCorpus,
} from '../provision/local-render-corpus/registry.ts';
import { MANAGED_STATUS_PER_QUERY_TIMEOUT_MS } from '../provision/managed-status.ts';
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
	ObservabilityFingerprints,
	ObservabilitySnapshot,
	ObservabilitySourceState,
	ValidationEvidenceType,
	ValidationEvidenceView,
} from './types.ts';

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

export async function buildObservabilitySnapshot(options?: {
	probeTimeoutMs?: number;
}): Promise<ObservabilitySnapshot> {
	const probeTimeoutMs = options?.probeTimeoutMs ?? MANAGED_STATUS_PER_QUERY_TIMEOUT_MS;
	const degradedNotes: string[] = [];
	const generatedAt = new Date().toISOString();
	const source = readObservabilitySourceState();
	if (source.degraded) {
		degradedNotes.push(source.detail ?? 'Git source identity degraded');
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

	const [invitationResult, migrationResult] = await Promise.all([
		(async () => {
			try {
				return { ok: true as const, value: await evaluateInvitationHealth({ probeTimeoutMs }) };
			} catch (error) {
				return {
					ok: false as const,
					error: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
				};
			}
		})(),
		(async () => {
			try {
				return { ok: true as const, value: evaluateMigrationHealth() };
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

	if (migrationResult.ok) {
		migrations = migrationResult.value;
	} else {
		degradedNotes.push(`Migration health degraded: ${migrationResult.error}`);
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
			assets,
			probeTimeoutMs,
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
