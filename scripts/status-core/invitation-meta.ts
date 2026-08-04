/**
 * Managed-invitation metadata projection — no draft/published content bodies.
 */

import { sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	classifyPackageHashContent,
	type ContentStatusVocabulary,
} from './classify-content.ts';
import type { StatusProbeSession } from './probe-runner.ts';

export interface ManagedInvitationMeta {
	activeMatchCount: number;
	resolvedId: string | null;
	resolvedSlug: string | null;
	provenanceDefinitionSlug: string | null;
	provenancePackageHash: string | null;
	provenanceAppliedAt: string | null;
	publishedVersion: number | null;
	publishedAt: string | null;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	assetCount: number;
	queryFailed: boolean;
}

export interface ClassifiedInvitationMeta extends ManagedInvitationMeta {
	status: ContentStatusVocabulary;
	detail: string;
}

const META_SQL = (slugLiteral: string) => `
SELECT
  concat_ws(
    '|',
    i.id::text,
    i.slug,
    COALESCE(p.definition_slug, ''),
    COALESCE(p.package_hash, ''),
    COALESCE(p.applied_at::text, ''),
    COALESCE(pub.version::text, ''),
    COALESCE(pub.published_at::text, ''),
    COALESCE(d.status, ''),
    COALESCE(d.updated_at::text, ''),
    COALESCE(a.asset_count, 0)::text
  )
FROM public.invitations i
LEFT JOIN public.managed_invitation_release_provenance p ON p.invitation_id = i.id
LEFT JOIN LATERAL (
  SELECT version, published_at
  FROM public.published_invitation_content
  WHERE invitation_project_id = i.id ORDER BY version DESC LIMIT 1
) pub ON true
LEFT JOIN LATERAL (
  SELECT status, updated_at FROM public.invitation_content_drafts
  WHERE invitation_project_id = i.id AND deleted_at IS NULL LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS asset_count FROM public.invitation_assets
  WHERE invitation_id = i.id AND deleted_at IS NULL
) a ON true
WHERE i.archived_at IS NULL
  AND i.slug = ${slugLiteral};
`.trim();

function parseMetaRows(stdout: string): ManagedInvitationMeta[] {
	const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
	return lines.map((line) => {
		const parts = line.split('|').map((s) => s.trim());
		const [
			invId,
			invSlug,
			provSlug,
			provHash,
			provApplied,
			pubVer,
			pubAt,
			draftStatus,
			draftUpdatedAt,
			assetCountStr,
		] = parts;
		return {
			activeMatchCount: 1,
			resolvedId: invId || null,
			resolvedSlug: invSlug || null,
			provenanceDefinitionSlug: provSlug || null,
			provenancePackageHash: provHash || null,
			provenanceAppliedAt: provApplied || null,
			publishedVersion: pubVer ? Number(pubVer) : null,
			publishedAt: pubAt || null,
			draftStatus: draftStatus || null,
			draftUpdatedAt: draftUpdatedAt || null,
			assetCount: Number(assetCountStr || '0'),
			queryFailed: false,
		};
	});
}

function emptyMeta(partial: Partial<ManagedInvitationMeta> = {}): ManagedInvitationMeta {
	return {
		activeMatchCount: 0,
		resolvedId: null,
		resolvedSlug: null,
		provenanceDefinitionSlug: null,
		provenancePackageHash: null,
		provenanceAppliedAt: null,
		publishedVersion: null,
		publishedAt: null,
		draftStatus: null,
		draftUpdatedAt: null,
		assetCount: 0,
		queryFailed: false,
		...partial,
	};
}

export async function readManagedInvitationMeta(
	session: StatusProbeSession,
	dbUrl: string,
	slug: string,
): Promise<ManagedInvitationMeta> {
	const sql = META_SQL(sqlLiteral(slug));
	const result = await session.psql(sql, dbUrl, { tuplesOnly: true });
	if (result.status !== 0) {
		return emptyMeta({ queryFailed: true });
	}
	const rows = parseMetaRows(result.stdout);
	if (rows.length === 0) return emptyMeta();
	if (rows.length === 1) return rows[0]!;
	return emptyMeta({
		activeMatchCount: rows.length,
		resolvedSlug: slug,
		queryFailed: false,
	});
}

export function readManagedInvitationMetaSync(
	session: StatusProbeSession,
	dbUrl: string,
	slug: string,
): ManagedInvitationMeta {
	const sql = META_SQL(sqlLiteral(slug));
	const result = session.psqlSync(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (result.status !== 0) {
		return emptyMeta({ queryFailed: true });
	}
	const rows = parseMetaRows(result.stdout);
	if (rows.length === 0) return emptyMeta();
	if (rows.length === 1) return rows[0]!;
	return emptyMeta({
		activeMatchCount: rows.length,
		resolvedSlug: slug,
		queryFailed: false,
	});
}

export function classifyManagedInvitationMeta(
	meta: ManagedInvitationMeta,
	canonicalHash: string | null,
	slug: string,
): ClassifiedInvitationMeta {
	if (meta.queryFailed) {
		return {
			...meta,
			status: 'UNREACHABLE',
			detail: 'Target database query failed',
		};
	}
	if (meta.activeMatchCount === 0) {
		return {
			...meta,
			status: 'NOT_PRESENT',
			detail: `Invitation ${slug} not present in target DB`,
		};
	}
	const classified = classifyPackageHashContent({
		activeMatchCount: meta.activeMatchCount,
		resolvedId: meta.resolvedId,
		provenancePackageHash: meta.provenancePackageHash,
		canonicalHash,
		draftStatus: meta.draftStatus,
		draftUpdatedAt: meta.draftUpdatedAt,
		publishedAt: meta.publishedAt,
	});
	return {
		...meta,
		status: classified.status,
		detail: classified.detail,
	};
}
