/**
 * Grouped live promotional evidence — one SQL read per environment.
 * No promotion policy. Does not print or retain credentials.
 */
import { sqlLiteral } from '../db/db-workflow-lib.ts';
import type { StatusProbeSession } from './probe-runner.ts';

export interface LiveAssetEvidenceRow {
	id: string | null;
	managedSourceKey: string | null;
	managedSha256: string | null;
	sha256: string | null;
}

export interface LiveInvitationEvidenceRow {
	slug: string;
	eventType: string | null;
	kind: string | null;
	baseDemoId: string | null;
	themeId: string | null;
	snapshot: unknown;
	managedIdentityId: string | null;
	definitionSlug: string | null;
	draftContent: unknown;
	publishedContent: unknown;
	assets: LiveAssetEvidenceRow[];
}

export type PromotionalEvidenceFailure =
	| 'credentials'
	| 'unreachable'
	| 'query_failed'
	| 'timeout';

export interface GroupedPromotionalEvidence {
	ok: boolean;
	failure?: PromotionalEvidenceFailure;
	rows: LiveInvitationEvidenceRow[];
}

function parseJsonArray(stdout: string): unknown[] {
	const start = stdout.indexOf('[');
	const end = stdout.lastIndexOf(']');
	if (start < 0 || end < start) return [];
	const parsed: unknown = JSON.parse(stdout.slice(start, end + 1));
	return Array.isArray(parsed) ? parsed : [];
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseAsset(value: unknown): LiveAssetEvidenceRow | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	return {
		id: stringOrNull(row.id),
		managedSourceKey: stringOrNull(row.managedSourceKey),
		managedSha256: stringOrNull(row.managedSha256),
		sha256: stringOrNull(row.sha256),
	};
}

function parseRow(value: unknown): LiveInvitationEvidenceRow | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	const slug = stringOrNull(row.slug);
	if (!slug) return null;
	const assetsRaw = Array.isArray(row.assets) ? row.assets : [];
	return {
		slug,
		eventType: stringOrNull(row.eventType),
		kind: stringOrNull(row.kind),
		baseDemoId: stringOrNull(row.baseDemoId),
		themeId: stringOrNull(row.themeId),
		snapshot: row.snapshot ?? null,
		managedIdentityId: stringOrNull(row.managedIdentityId),
		definitionSlug: stringOrNull(row.definitionSlug),
		draftContent: row.draftContent ?? null,
		publishedContent: row.publishedContent ?? null,
		assets: assetsRaw.map(parseAsset).filter((asset): asset is LiveAssetEvidenceRow =>
			Boolean(asset),
		),
	};
}

export function buildGroupedPromotionalEvidenceSql(slugs: readonly string[]): string {
	const slugList = slugs.map((slug) => sqlLiteral(slug)).join(', ');
	return `
SELECT coalesce(json_agg(t), '[]'::json)
FROM (
  SELECT
    i.slug,
    i.event_type AS "eventType",
    i.kind,
    i.base_demo_id AS "baseDemoId",
    i.theme_id AS "themeId",
    i.snapshot,
    i.managed_identity_id AS "managedIdentityId",
    p.definition_slug AS "definitionSlug",
    d.content AS "draftContent",
    pub.content AS "publishedContent",
    coalesce(a.assets, '[]'::json) AS assets
  FROM public.invitations i
  LEFT JOIN public.managed_invitation_release_provenance p ON p.invitation_id = i.id
  LEFT JOIN LATERAL (
    SELECT d0.content
    FROM public.invitation_content_drafts d0
    WHERE d0.invitation_project_id = i.id AND d0.deleted_at IS NULL
    ORDER BY d0.updated_at DESC
    LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT p0.content
    FROM public.published_invitation_content p0
    WHERE p0.invitation_project_id = i.id AND p0.deleted_at IS NULL
    ORDER BY p0.version DESC
    LIMIT 1
  ) pub ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
      'id', ia.id,
      'managedSourceKey', ia.managed_source_key,
      'managedSha256', ia.managed_sha256,
      'sha256', ia.sha256
    ) ORDER BY ia.managed_source_key)
    AS assets
    FROM public.invitation_assets ia
    WHERE ia.invitation_id = i.id AND ia.deleted_at IS NULL
  ) a ON true
  WHERE i.archived_at IS NULL
    AND i.slug IN (${slugList})
) t;
`.trim();
}

export async function readGroupedPromotionalEvidence(
	session: StatusProbeSession,
	dbUrl: string,
	slugs: readonly string[],
): Promise<GroupedPromotionalEvidence> {
	if (slugs.length === 0) return { ok: true, rows: [] };
	const sql = buildGroupedPromotionalEvidenceSql(slugs);
	const result = await session.psql(sql, dbUrl, { tuplesOnly: true });
	if (result.status !== 0) {
		return { ok: false, failure: 'query_failed', rows: [] };
	}
	try {
		const rows = parseJsonArray(result.stdout)
			.map(parseRow)
			.filter((row): row is LiveInvitationEvidenceRow => Boolean(row));
		return { ok: true, rows };
	} catch {
		return { ok: false, failure: 'query_failed', rows: [] };
	}
}
