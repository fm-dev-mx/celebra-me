/**
 * Per-invitation health for the Local Render Corpus (canonical + legacy).
 * Failure-isolated: one classifier failure must not suppress other rows.
 */

import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	evaluateBatchTargetStatuses,
	evaluateSingleTargetStatus,
	resolveDbUrlForEnv,
	withStatusProbeTimeout,
	type PerInvitationTargetStatus,
	type TargetEnv,
	type StatusVocabulary,
} from '../provision/dbs-status.ts';
import { buildNormalizedInvitationRelease } from '../provision/normalized-invitation-release.ts';
import { serializeInvitationPackage } from '../provision/invitation-package.ts';
import {
	corpusPublicRoute,
	listLocalRenderCorpus,
	type LocalRenderCorpusEntry,
} from '../provision/local-render-corpus/registry.ts';
import { loadLegacyCorpusFixture } from '../provision/local-render-corpus/load-fixture.ts';
import type {
	InvitationEnvContentState,
	InvitationEnvStatusRow,
	InvitationHealthRow,
	LegacyContentState,
	ReferenceClassification,
} from './types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

function redactDetail(message: string): string {
	return message
		.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
		.replace(/:[^:@/]+@/g, ':***@')
		.slice(0, 160);
}

function mapConnectivity(status: StatusVocabulary): InvitationEnvContentState | null {
	if (
		status === 'NOT_PRESENT' ||
		status === 'IDENTITY_CONFLICT' ||
		status === 'UNREACHABLE' ||
		status === 'CREDENTIALS_REQUIRED'
	) {
		return status;
	}
	return null;
}

function fetchPublishedProjectionHash(env: TargetEnv, invitationId: string): string | null {
	const { dbUrl } = resolveDbUrlForEnv(env);
	if (!dbUrl) return null;
	const res = runPsql(
		`select content::text from public.published_invitation_content where invitation_project_id = ${sqlLiteral(invitationId)}::uuid order by version desc limit 1;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: false, timeoutMs: 4_000 },
	);
	if (res.status !== 0 || !res.stdout.trim()) return null;
	try {
		const content = JSON.parse(res.stdout.trim()) as Record<string, unknown>;
		return hashPublicationProjection(content);
	} catch {
		return null;
	}
}

async function resolveCanonicalPackageHash(slug: string): Promise<string | null> {
	try {
		const release = await buildNormalizedInvitationRelease({ slug });
		return serializeInvitationPackage(release).packageHash;
	} catch {
		return null;
	}
}

function classifyCanonicalEnv(
	probe: ReturnType<typeof evaluateSingleTargetStatus>,
): InvitationEnvStatusRow {
	const connectivity = mapConnectivity(probe.status);
	const status: InvitationEnvContentState =
		connectivity ??
		(probe.status === 'MATCH_CANONICAL' ||
		probe.status === 'BEHIND_CANONICAL' ||
		probe.status === 'DIVERGED' ||
		probe.status === 'UNVERIFIED'
			? probe.status
			: 'UNVERIFIED');

	return {
		environment: probe.environment,
		status,
		publishedVersion: probe.publishedVersion,
		assetCount: probe.assetCount,
		detail: redactDetail(probe.detail),
	};
}

function classifyLegacyEnv(
	probe: ReturnType<typeof evaluateSingleTargetStatus>,
	referenceHash: string | null,
): InvitationEnvStatusRow {
	const connectivity = mapConnectivity(probe.status);
	if (connectivity) {
		return {
			environment: probe.environment,
			status: connectivity,
			publishedVersion: probe.publishedVersion,
			assetCount: probe.assetCount,
			detail: redactDetail(probe.detail),
		};
	}

	if (!probe.resolvedId) {
		return {
			environment: probe.environment,
			status: 'UNVERIFIED',
			publishedVersion: probe.publishedVersion,
			assetCount: probe.assetCount,
			detail: 'Present without resolvable identity',
		};
	}

	// Reference-relative MATCH/DIVERGED is Local-only. Remotes are presence-only.
	if (probe.environment !== 'local') {
		return {
			environment: probe.environment,
			status: 'UNVERIFIED',
			publishedVersion: probe.publishedVersion,
			assetCount: probe.assetCount,
			detail: 'Legacy presence-only on remote (reference compare is Local-only)',
		};
	}

	if (!referenceHash) {
		return {
			environment: probe.environment,
			status: 'UNVERIFIED',
			publishedVersion: probe.publishedVersion,
			assetCount: probe.assetCount,
			detail: 'Reference fixture hash unavailable',
		};
	}

	const publishedHash = fetchPublishedProjectionHash(probe.environment, probe.resolvedId);
	if (!publishedHash) {
		return {
			environment: probe.environment,
			status: 'UNVERIFIED',
			publishedVersion: probe.publishedVersion,
			assetCount: probe.assetCount,
			detail: 'Published content hash unavailable',
		};
	}

	const status: LegacyContentState =
		publishedHash === referenceHash ? 'MATCH_REFERENCE' : 'DIVERGED_FROM_REFERENCE';

	return {
		environment: probe.environment,
		status,
		publishedVersion: probe.publishedVersion,
		assetCount: probe.assetCount,
		detail:
			status === 'MATCH_REFERENCE'
				? 'Published content matches Local corpus fixture reference'
				: 'Published content diverged from Local corpus fixture reference',
	};
}

function recommendedCommandForRow(
	entry: LocalRenderCorpusEntry,
	envs: InvitationHealthRow['environments'],
): { command: string | null; failureCause: string | null } {
	const local = envs.local.status;
	if (local === 'NOT_PRESENT') {
		return {
			command: `pnpm invitation:local-corpus --dry-run --slug ${entry.slug}`,
			failureCause: 'Missing from Local corpus',
		};
	}
	if (local === 'IDENTITY_CONFLICT') {
		return {
			command: `pnpm dbs --compact ${entry.slug}`,
			failureCause: 'Identity conflict in Local',
		};
	}
	if (entry.classification === 'canonical') {
		if (local === 'BEHIND_CANONICAL' || local === 'DIVERGED') {
			return {
				command: `pnpm dbs --compact ${entry.slug}`,
				failureCause: local,
			};
		}
	} else if (local === 'DIVERGED_FROM_REFERENCE') {
		return {
			command: `pnpm invitation:local-corpus --dry-run --slug ${entry.slug}`,
			failureCause: 'Local diverged from corpus fixture reference',
		};
	}
	if (envs.production.status === 'BEHIND_CANONICAL') {
		return {
			command: `pnpm invitation:content-parity -- --slug ${entry.slug} --event-type ${entry.eventType}`,
			failureCause: 'Production behind canonical (do not invitation:update Production)',
		};
	}
	return { command: null, failureCause: null };
}

async function evaluateCanonicalEntry(
	entry: LocalRenderCorpusEntry,
	probeTimeoutMs: number,
	probeEnvs: readonly TargetEnv[] = ENVS,
): Promise<InvitationHealthRow> {
	const packageHash = await resolveCanonicalPackageHash(entry.slug);
	const environments = {} as InvitationHealthRow['environments'];
	for (const env of ENVS) {
		if (!probeEnvs.includes(env)) {
			environments[env] = {
				environment: env,
				status: 'UNVERIFIED',
				publishedVersion: null,
				assetCount: 0,
				detail: 'Not probed in this observability scope',
			};
			continue;
		}
		const probe = withStatusProbeTimeout(probeTimeoutMs, () =>
			evaluateSingleTargetStatus(env, entry.slug, packageHash),
		);
		environments[env] = classifyCanonicalEnv(probe);
	}
	const { command, failureCause } = recommendedCommandForRow(entry, environments);
	return {
		slug: entry.slug,
		eventType: entry.eventType,
		referenceClassification: 'CANONICAL_MANAGED',
		themeId: entry.themeId ?? null,
		visualProfileId: entry.visualProfileId ?? null,
		assetStrategy: entry.assetStrategy,
		publicRoute: corpusPublicRoute(entry),
		environments,
		recommendedCommand: command,
		failureCause,
	};
}

function resolveLegacyReferenceHash(entry: LocalRenderCorpusEntry): string | null {
	try {
		const fixture = loadLegacyCorpusFixture(entry);
		return hashPublicationProjection(fixture.publishedContent);
	} catch {
		return null;
	}
}

async function evaluateLegacyEntry(
	entry: LocalRenderCorpusEntry,
	probeTimeoutMs: number,
	probeEnvs: readonly TargetEnv[] = ENVS,
): Promise<InvitationHealthRow> {
	const referenceHash = resolveLegacyReferenceHash(entry);
	const environments = {} as InvitationHealthRow['environments'];
	for (const env of ENVS) {
		if (!probeEnvs.includes(env)) {
			environments[env] = {
				environment: env,
				status: 'UNVERIFIED',
				publishedVersion: null,
				assetCount: 0,
				detail: 'Not probed in this observability scope',
			};
			continue;
		}
		const probe = withStatusProbeTimeout(probeTimeoutMs, () =>
			evaluateSingleTargetStatus(env, entry.slug, null),
		);
		environments[env] = classifyLegacyEnv(probe, referenceHash);
	}
	const { command, failureCause } = recommendedCommandForRow(entry, environments);
	return {
		slug: entry.slug,
		eventType: entry.eventType,
		referenceClassification: 'LOCAL_CORPUS_REFERENCE' satisfies ReferenceClassification,
		themeId: entry.themeId ?? null,
		visualProfileId: entry.visualProfileId ?? null,
		assetStrategy: entry.assetStrategy,
		publicRoute: corpusPublicRoute(entry),
		environments,
		recommendedCommand: command,
		failureCause,
	};
}

function failedRow(entry: LocalRenderCorpusEntry, message: string): InvitationHealthRow {
	const unverified = (environment: TargetEnv): InvitationEnvStatusRow => ({
		environment,
		status: 'UNVERIFIED',
		publishedVersion: null,
		assetCount: 0,
		detail: redactDetail(message),
	});
	return {
		slug: entry.slug,
		eventType: entry.eventType,
		referenceClassification:
			entry.classification === 'canonical' ? 'CANONICAL_MANAGED' : 'LOCAL_CORPUS_REFERENCE',
		themeId: entry.themeId ?? null,
		visualProfileId: entry.visualProfileId ?? null,
		assetStrategy: entry.assetStrategy,
		publicRoute: corpusPublicRoute(entry),
		environments: {
			local: unverified('local'),
			preview: unverified('preview'),
			production: unverified('production'),
		},
		recommendedCommand: `pnpm dbs --compact ${entry.slug}`,
		failureCause: 'Classifier failure',
	};
}

type BatchRow = PerInvitationTargetStatus & { publishedContent?: string | null };
type BatchStatusMap = Map<TargetEnv, Map<string, BatchRow>>;

function skippedEnv(environment: TargetEnv): InvitationEnvStatusRow {
	return {
		environment,
		status: 'UNVERIFIED',
		publishedVersion: null,
		assetCount: 0,
		detail: 'Not probed in this observability scope',
	};
}

function classifyLegacyBatchStatus(
	env: TargetEnv,
	entry: LocalRenderCorpusEntry,
	batchStatus: BatchRow,
): InvitationEnvStatusRow {
	const connectivity = mapConnectivity(batchStatus.status);
	if (
		connectivity ||
		batchStatus.status === 'NOT_PRESENT' ||
		batchStatus.status === 'IDENTITY_CONFLICT'
	) {
		return {
			environment: env,
			status: connectivity ?? batchStatus.status,
			publishedVersion: batchStatus.publishedVersion,
			assetCount: batchStatus.assetCount,
			detail: redactDetail(batchStatus.detail),
		};
	}
	if (env !== 'local') {
		return {
			environment: env,
			status: 'UNVERIFIED',
			publishedVersion: batchStatus.publishedVersion,
			assetCount: batchStatus.assetCount,
			detail: 'Legacy presence-only on remote (reference compare is Local-only)',
		};
	}

	const refHash = resolveLegacyReferenceHash(entry);
	if (!refHash || !batchStatus.publishedContent) {
		return {
			environment: env,
			status: 'UNVERIFIED',
			publishedVersion: batchStatus.publishedVersion,
			assetCount: batchStatus.assetCount,
			detail: redactDetail(batchStatus.detail),
		};
	}

	try {
		const contentJson = JSON.parse(batchStatus.publishedContent);
		const pubHash = hashPublicationProjection(contentJson);
		const legStatus: LegacyContentState =
			pubHash === refHash ? 'MATCH_REFERENCE' : 'DIVERGED_FROM_REFERENCE';
		return {
			environment: env,
			status: legStatus,
			publishedVersion: batchStatus.publishedVersion,
			assetCount: batchStatus.assetCount,
			detail:
				legStatus === 'MATCH_REFERENCE'
					? 'Published content matches Local corpus fixture reference'
					: 'Published content diverged from Local corpus fixture reference',
		};
	} catch {
		return {
			environment: env,
			status: 'UNVERIFIED',
			publishedVersion: batchStatus.publishedVersion,
			assetCount: batchStatus.assetCount,
			detail: redactDetail(batchStatus.detail),
		};
	}
}

/** Returns null when a probed env is missing from the batch map (caller should fallback). */
function classifyEntryFromBatch(
	entry: LocalRenderCorpusEntry,
	probeEnvs: readonly TargetEnv[],
	batchResults: BatchStatusMap,
): InvitationHealthRow['environments'] | null {
	const envs = {} as InvitationHealthRow['environments'];
	for (const env of ENVS) {
		if (!probeEnvs.includes(env)) {
			envs[env] = skippedEnv(env);
			continue;
		}
		const batchStatus = batchResults.get(env)?.get(entry.slug);
		if (!batchStatus) return null;

		if (entry.classification === 'legacy') {
			envs[env] = classifyLegacyBatchStatus(env, entry, batchStatus);
		} else {
			envs[env] = {
				environment: env,
				status: batchStatus.status,
				publishedVersion: batchStatus.publishedVersion,
				assetCount: batchStatus.assetCount,
				detail: redactDetail(batchStatus.detail),
			};
		}
	}
	return envs;
}

export async function evaluateInvitationHealth(options?: {
	probeTimeoutMs?: number;
	/** Environments to probe. Summary path uses `['local']` only. */
	environments?: readonly TargetEnv[];
}): Promise<InvitationHealthRow[]> {
	const timeout = options?.probeTimeoutMs ?? 2_000;
	const probeEnvs: TargetEnv[] = options?.environments ? [...options.environments] : [...ENVS];
	const corpus = listLocalRenderCorpus();
	const corpusSlugs = corpus.map((entry) => entry.slug);

	const canonicalHashes = new Map<string, string | null>();
	await Promise.all(
		corpus.map(async (entry) => {
			if (entry.classification === 'canonical') {
				const hash = await resolveCanonicalPackageHash(entry.slug);
				canonicalHashes.set(entry.slug, hash);
			}
		}),
	);

	const batchResults = new Map<TargetEnv, ReturnType<typeof evaluateBatchTargetStatuses>>();
	for (const env of probeEnvs) {
		batchResults.set(
			env,
			withStatusProbeTimeout(timeout, () =>
				evaluateBatchTargetStatuses(env, canonicalHashes, {
					slugs: corpusSlugs,
					// Published JSON is only needed for Local legacy reference hashing.
					includePublishedContent: env === 'local',
				}),
			),
		);
	}

	const settled = await Promise.allSettled(
		corpus.map(async (entry) => {
			const classified = classifyEntryFromBatch(entry, probeEnvs, batchResults);
			if (!classified) {
				return entry.classification === 'canonical'
					? await evaluateCanonicalEntry(entry, timeout, probeEnvs)
					: await evaluateLegacyEntry(entry, timeout, probeEnvs);
			}

			const { command, failureCause } = recommendedCommandForRow(entry, classified);
			return {
				slug: entry.slug,
				eventType: entry.eventType,
				referenceClassification:
					entry.classification === 'canonical'
						? ('CANONICAL_MANAGED' as const)
						: ('LOCAL_CORPUS_REFERENCE' as const),
				themeId: entry.themeId ?? null,
				visualProfileId: entry.visualProfileId ?? null,
				assetStrategy: entry.assetStrategy,
				publicRoute: corpusPublicRoute(entry),
				environments: classified,
				recommendedCommand: command,
				failureCause,
			};
		}),
	);

	return settled.map((result, index) => {
		const entry = corpus[index]!;
		if (result.status === 'fulfilled') return result.value;
		return failedRow(
			entry,
			result.reason instanceof Error ? result.reason.message : 'Classifier failure',
		);
	});
}

/** Local corpus presence count for an environment (supported clients only). */
export function countCorpusPresence(
	invitations: readonly InvitationHealthRow[],
	env: TargetEnv,
): { present: number; total: number } {
	const total = invitations.length;
	const present = invitations.filter((row) => {
		const status = row.environments[env].status;
		return (
			status !== 'NOT_PRESENT' &&
			status !== 'CREDENTIALS_REQUIRED' &&
			status !== 'UNREACHABLE'
		);
	}).length;
	return { present, total };
}
