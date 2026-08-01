/**
 * Batched per-environment health for the Local Render Corpus.
 * One psql process per configured environment replaces per-slug probe fan-out.
 */

import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import { resolveDbUrlForEnv, type TargetEnv } from '../provision/dbs-status.ts';
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
	ReferenceClassification,
} from './types.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];

interface BatchRow {
	slug: string;
	activeCount: number;
	resolvedId: string | null;
	provenanceHash: string | null;
	publishedVersion: number | null;
	publishedAt: string | null;
	publishedContent: Record<string, unknown> | null;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	assetCount: number;
}

export interface BatchEnvironmentStats {
	environment: TargetEnv;
	configured: boolean;
	reachable: boolean;
	activeInvitationRows: number;
	identityConflictsCount: number;
}

export interface InvitationHealthBatch {
	invitations: InvitationHealthRow[];
	environmentStats: Record<TargetEnv, BatchEnvironmentStats>;
	probeCount: number;
}

interface BatchPayload {
	activeInvitationRows: number;
	rows: BatchRow[];
}

function safeText(value: unknown): string | null {
	return typeof value === 'string' ? value.slice(0, 160) : null;
}

function normalizePayload(value: unknown): BatchPayload | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	if (!Array.isArray(record.rows) || !Number.isInteger(record.activeInvitationRows)) return null;
	const rows: BatchRow[] = [];
	for (const valueRow of record.rows) {
		if (!valueRow || typeof valueRow !== 'object') return null;
		const row = valueRow as Record<string, unknown>;
		if (typeof row.slug !== 'string' || !Number.isInteger(row.activeCount)) return null;
		rows.push({
			slug: row.slug,
			activeCount: Number(row.activeCount),
			resolvedId: safeText(row.resolvedId),
			provenanceHash: safeText(row.provenanceHash),
			publishedVersion: Number.isInteger(row.publishedVersion)
				? Number(row.publishedVersion)
				: null,
			publishedAt: safeText(row.publishedAt),
			publishedContent:
				row.publishedContent && typeof row.publishedContent === 'object'
					? (row.publishedContent as Record<string, unknown>)
					: null,
			draftStatus: safeText(row.draftStatus),
			draftUpdatedAt: safeText(row.draftUpdatedAt),
			assetCount: Number.isInteger(row.assetCount) ? Number(row.assetCount) : 0,
		});
	}
	return { activeInvitationRows: Number(record.activeInvitationRows), rows };
}

function buildBatchSql(
	entries: readonly LocalRenderCorpusEntry[],
	includeContent: boolean,
): string {
	const wanted = entries.map((entry) => `(${sqlLiteral(entry.slug)})`).join(',\n');
	const legacySlugs = entries
		.filter((entry) => entry.classification === 'legacy')
		.map((entry) => sqlLiteral(entry.slug));
	const contentProjection =
		includeContent && legacySlugs.length > 0
			? `case when m.slug in (${legacySlugs.join(', ')}) then pub.content else null::jsonb end`
			: 'null::jsonb';
	return `
with wanted(slug) as (values ${wanted}),
matches as (
  select w.slug,
         count(i.id)::int as active_count,
         (array_agg(i.id::text order by i.created_at) filter (where i.id is not null))[1] as resolved_id
    from wanted w
    left join public.invitations i on i.slug = w.slug and i.archived_at is null
   group by w.slug
),
rows as (
  select m.slug,
         m.active_count,
         case when m.active_count = 1 then m.resolved_id else null end as resolved_id,
         prov.package_hash as provenance_hash,
         pub.version as published_version,
         pub.published_at,
         ${contentProjection} as published_content,
         draft.status as draft_status,
         draft.updated_at as draft_updated_at,
         coalesce(assets.asset_count, 0)::int as asset_count
    from matches m
    left join lateral (
      select package_hash
        from public.managed_invitation_release_provenance
       where invitation_id = m.resolved_id::uuid and m.active_count = 1
       limit 1
    ) prov on true
    left join lateral (
      select version, published_at, content
        from public.published_invitation_content
       where invitation_project_id = m.resolved_id::uuid and m.active_count = 1
       order by version desc limit 1
    ) pub on true
    left join lateral (
      select status, updated_at
        from public.invitation_content_drafts
       where invitation_project_id = m.resolved_id::uuid and m.active_count = 1 and deleted_at is null
       limit 1
    ) draft on true
    left join lateral (
      select count(*)::int as asset_count
        from public.invitation_assets
       where invitation_id = m.resolved_id::uuid and m.active_count = 1 and deleted_at is null
    ) assets on true
)
select json_build_object(
  'activeInvitationRows', (select count(*)::int from public.invitations where archived_at is null),
  'rows', coalesce(json_agg(json_build_object(
    'slug', slug,
    'activeCount', active_count,
    'resolvedId', resolved_id,
    'provenanceHash', provenance_hash,
    'publishedVersion', published_version,
    'publishedAt', published_at,
    'publishedContent', published_content,
    'draftStatus', draft_status,
    'draftUpdatedAt', draft_updated_at,
    'assetCount', asset_count
  ) order by slug), '[]'::json)
) from rows;`;
}

function probeEnvironment(
	env: TargetEnv,
	entries: readonly LocalRenderCorpusEntry[],
	timeoutMs: number,
): { payload: BatchPayload | null; stats: BatchEnvironmentStats } {
	const { dbUrl } = resolveDbUrlForEnv(env);
	if (!dbUrl) {
		return {
			payload: null,
			stats: {
				environment: env,
				configured: false,
				reachable: false,
				activeInvitationRows: 0,
				identityConflictsCount: 0,
			},
		};
	}
	const result = runPsql(buildBatchSql(entries, env === 'local'), dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs,
	});
	if (result.status !== 0) {
		return {
			payload: null,
			stats: {
				environment: env,
				configured: true,
				reachable: false,
				activeInvitationRows: 0,
				identityConflictsCount: 0,
			},
		};
	}
	try {
		const payload = normalizePayload(JSON.parse(result.stdout.trim()));
		if (!payload) throw new Error('invalid_batch_payload');
		return {
			payload,
			stats: {
				environment: env,
				configured: true,
				reachable: true,
				activeInvitationRows: payload.activeInvitationRows,
				identityConflictsCount: payload.rows.filter((row) => row.activeCount > 1).length,
			},
		};
	} catch {
		return {
			payload: null,
			stats: {
				environment: env,
				configured: true,
				reachable: false,
				activeInvitationRows: 0,
				identityConflictsCount: 0,
			},
		};
	}
}

async function canonicalHashes(
	entries: readonly LocalRenderCorpusEntry[],
): Promise<Map<string, string | null>> {
	const pairs = await Promise.all(
		entries.map(async (entry) => {
			if (entry.classification !== 'canonical') return [entry.slug, null] as const;
			try {
				const release = await buildNormalizedInvitationRelease({ slug: entry.slug });
				return [entry.slug, serializeInvitationPackage(release).packageHash] as const;
			} catch {
				return [entry.slug, null] as const;
			}
		}),
	);
	return new Map(pairs);
}

function legacyReferenceHash(entry: LocalRenderCorpusEntry): string | null {
	try {
		return hashPublicationProjection(loadLegacyCorpusFixture(entry).publishedContent);
	} catch {
		return null;
	}
}

// eslint-disable-next-line complexity -- Fail-closed mapping covers every environment/content state.
function classifyRow(
	env: TargetEnv,
	entry: LocalRenderCorpusEntry,
	row: BatchRow | undefined,
	stats: BatchEnvironmentStats,
	canonicalHash: string | null,
): InvitationEnvStatusRow {
	let status: InvitationEnvContentState;
	if (!stats.configured) status = 'CREDENTIALS_REQUIRED';
	else if (!stats.reachable || !row) status = 'UNREACHABLE';
	else if (row.activeCount === 0) status = 'NOT_PRESENT';
	else if (row.activeCount > 1) status = 'IDENTITY_CONFLICT';
	else if (entry.classification === 'legacy') {
		if (env !== 'local') status = 'UNVERIFIED';
		else {
			const referenceHash = legacyReferenceHash(entry);
			const publishedHash = row.publishedContent
				? hashPublicationProjection(row.publishedContent)
				: null;
			status =
				referenceHash && publishedHash
					? referenceHash === publishedHash
						? 'MATCH_REFERENCE'
						: 'DIVERGED_FROM_REFERENCE'
					: 'UNVERIFIED';
		}
	} else if (!canonicalHash || !row.provenanceHash) status = 'UNVERIFIED';
	else if (canonicalHash !== row.provenanceHash) status = 'BEHIND_CANONICAL';
	else if (
		row.draftStatus === 'draft' &&
		row.draftUpdatedAt &&
		row.publishedAt &&
		new Date(row.draftUpdatedAt).getTime() > new Date(row.publishedAt).getTime()
	)
		status = 'DIVERGED';
	else status = 'MATCH_CANONICAL';

	return {
		environment: env,
		status,
		publishedVersion: row?.publishedVersion ?? null,
		assetCount: row?.assetCount ?? 0,
	};
}

export async function evaluateInvitationHealth(options?: {
	probeTimeoutMs?: number;
}): Promise<InvitationHealthBatch> {
	const timeoutMs = options?.probeTimeoutMs ?? 2_000;
	const entries = listLocalRenderCorpus();
	const hashes = await canonicalHashes(entries);
	const probes = Object.fromEntries(
		ENVS.map((env) => [env, probeEnvironment(env, entries, timeoutMs)]),
	) as Record<TargetEnv, ReturnType<typeof probeEnvironment>>;

	const invitations = entries.map((entry): InvitationHealthRow => {
		const environments = {} as InvitationHealthRow['environments'];
		for (const env of ENVS) {
			const row = probes[env].payload?.rows.find(
				(candidate) => candidate.slug === entry.slug,
			);
			environments[env] = classifyRow(
				env,
				entry,
				row,
				probes[env].stats,
				hashes.get(entry.slug) ?? null,
			);
		}
		return {
			slug: entry.slug,
			eventType: entry.eventType,
			referenceClassification:
				entry.classification === 'canonical'
					? 'CANONICAL_MANAGED'
					: ('LOCAL_CORPUS_REFERENCE' satisfies ReferenceClassification),
			themeId: entry.themeId ?? null,
			visualProfileId: entry.visualProfileId ?? null,
			assetStrategy: entry.assetStrategy,
			publicRoute: corpusPublicRoute(entry),
			environments,
			recommendedCommand: null,
			failureCause: null,
		};
	});

	return {
		invitations,
		environmentStats: {
			local: probes.local.stats,
			preview: probes.preview.stats,
			production: probes.production.stats,
		},
		probeCount: ENVS.filter((env) => probes[env].stats.configured).length,
	};
}

export function countCorpusPresence(
	invitations: readonly InvitationHealthRow[],
	env: TargetEnv,
): { present: number; total: number } {
	const total = invitations.length;
	const present = invitations.filter((row) => {
		const status = row.environments[env].status;
		return !['NOT_PRESENT', 'CREDENTIALS_REQUIRED', 'UNREACHABLE'].includes(status);
	}).length;
	return { present, total };
}
