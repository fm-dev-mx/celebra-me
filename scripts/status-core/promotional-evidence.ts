/**
 * Grouped live promotional evidence — one SQL family per environment.
 * Canonical mode is the lightweight projection. Diagnostics mode is the same
 * query with managed-projection payload included. Never run both in one cycle.
 */
import { sqlLiteral } from '../db/db-workflow-lib.ts';
import type { ManagedBaselineReceiptEvidence } from '../provision/managed-merge-baseline.ts';
import type { StatusProbeSession } from './probe-runner.ts';

export const DIAGNOSTIC_DETAIL_BUDGET_BYTES = 256 * 1024;

export interface LiveAssetEvidenceRow {
	id: string | null;
	managedSourceKey: string | null;
	managedSha256: string | null;
	sha256: string | null;
	displayName: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
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
	clientName: string | null;
	draftContent: unknown;
	publishedContent: unknown;
	publishedVersion: number | null;
	assets: LiveAssetEvidenceRow[];
	packageHash: string | null;
	releaseSchemaVersion: string | null;
	hasManagedProjection: boolean;
	appliedDraftUpdatedAt: string | null;
	appliedOperationId: string | null;
	appliedPublishedVersion: number | null;
	appliedPublishedProjectionHash: string | null;
	appliedReceipt: ManagedBaselineReceiptEvidence | null;
	latestReceipt: ManagedBaselineReceiptEvidence | null;
	managedProjection: Record<string, unknown> | null;
	detailBudgetExceeded: boolean;
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
	activeInvitationRows: number;
	identityConflictsCount: number;
}

export interface PromotionalEvidenceOptions {
	/** When true, include managed_projection JSON (same SQL family, heavier payload). */
	diagnostics?: boolean;
}

function parseJsonValue(stdout: string): unknown {
	const objectStart = stdout.indexOf('{');
	const arrayStart = stdout.indexOf('[');
	if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
		const end = stdout.lastIndexOf('}');
		if (end > objectStart) return JSON.parse(stdout.slice(objectStart, end + 1));
	}
	if (arrayStart >= 0) {
		const end = stdout.lastIndexOf(']');
		if (end > arrayStart) return JSON.parse(stdout.slice(arrayStart, end + 1));
	}
	return JSON.parse(stdout.trim());
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function receipt(value: unknown): ManagedBaselineReceiptEvidence | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	const operationId = stringOrNull(row.operationId);
	const status = stringOrNull(row.status);
	const commandKind = stringOrNull(row.commandKind);
	if (
		!operationId ||
		!commandKind ||
		!status ||
		!['not_applied', 'applied', 'partial', 'replayed'].includes(status)
	) {
		return null;
	}
	return {
		operationId,
		status: status as ManagedBaselineReceiptEvidence['status'],
		commandKind,
		origin: stringOrNull(row.origin) ?? undefined,
		completedSteps: Array.isArray(row.completedSteps)
			? row.completedSteps.filter((item): item is string => typeof item === 'string')
			: [],
		inputHashes:
			row.inputHashes && typeof row.inputHashes === 'object' && !Array.isArray(row.inputHashes)
				? (row.inputHashes as Record<string, unknown>)
				: undefined,
	};
}

function parseAsset(value: unknown): LiveAssetEvidenceRow | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const row = value as Record<string, unknown>;
	return {
		id: stringOrNull(row.id),
		managedSourceKey: stringOrNull(row.managedSourceKey),
		managedSha256: stringOrNull(row.managedSha256),
		sha256: stringOrNull(row.sha256),
		displayName: stringOrNull(row.displayName),
		mimeType: stringOrNull(row.mimeType),
		width: numberOrNull(row.width),
		height: numberOrNull(row.height),
		fileSize: numberOrNull(row.fileSize),
	};
}

function parseProjection(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
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
		clientName: stringOrNull(row.clientName),
		draftContent: row.draftContent ?? null,
		publishedContent: row.publishedContent ?? null,
		publishedVersion: numberOrNull(row.publishedVersion),
		assets: assetsRaw
			.map(parseAsset)
			.filter((asset): asset is LiveAssetEvidenceRow => Boolean(asset)),
		packageHash: stringOrNull(row.packageHash),
		releaseSchemaVersion: stringOrNull(row.releaseSchemaVersion),
		hasManagedProjection: row.hasManagedProjection === true,
		appliedDraftUpdatedAt: stringOrNull(row.appliedDraftUpdatedAt),
		appliedOperationId: stringOrNull(row.appliedOperationId),
		appliedPublishedVersion: numberOrNull(row.appliedPublishedVersion),
		appliedPublishedProjectionHash: stringOrNull(row.appliedPublishedProjectionHash),
		appliedReceipt: receipt(row.appliedReceipt),
		latestReceipt: receipt(row.latestReceipt),
		managedProjection: parseProjection(row.managedProjection),
		detailBudgetExceeded: row.detailBudgetExceeded === true,
	};
}

export function buildGroupedPromotionalEvidenceSql(
	slugs: readonly string[],
	options: PromotionalEvidenceOptions = {},
): string {
	const slugList = slugs.map((slug) => sqlLiteral(slug)).join(', ');
	const diagnostics = Boolean(options.diagnostics);
	const projectionSelect = diagnostics
		? `CASE
        WHEN coalesce(octet_length(p.managed_projection::text), 0) <= ${DIAGNOSTIC_DETAIL_BUDGET_BYTES}
        THEN p.managed_projection ELSE NULL END AS "managedProjection",
      coalesce(octet_length(p.managed_projection::text), 0) > ${DIAGNOSTIC_DETAIL_BUDGET_BYTES}
        AS "detailBudgetExceeded"`
		: `NULL::jsonb AS "managedProjection", false AS "detailBudgetExceeded"`;
	return `
SELECT json_build_object(
  'activeInvitationRows', (SELECT count(*) FROM public.invitations WHERE archived_at IS NULL),
  'identityConflictsCount', (
    SELECT coalesce(sum(count_for_slug - 1), 0)
    FROM (
      SELECT count(*) AS count_for_slug
      FROM public.invitations WHERE archived_at IS NULL
      GROUP BY slug HAVING count(*) > 1
    ) conflicts
  ),
  'rows', coalesce(json_agg(t), '[]'::json)
)
FROM (
  SELECT
    i.slug,
    i.event_type AS "eventType",
    i.kind,
    i.base_demo_id AS "baseDemoId",
    i.theme_id AS "themeId",
    i.snapshot,
    i.managed_identity_id AS "managedIdentityId",
    i.client_name AS "clientName",
    p.definition_slug AS "definitionSlug",
    p.package_hash AS "packageHash",
    p.release_schema_version AS "releaseSchemaVersion",
    (
      p.managed_projection IS NOT NULL
      AND jsonb_typeof(p.managed_projection) = 'object'
      AND p.managed_projection <> '{}'::jsonb
    ) AS "hasManagedProjection",
    p.applied_draft_updated_at AS "appliedDraftUpdatedAt",
    p.applied_operation_id AS "appliedOperationId",
    p.applied_published_version AS "appliedPublishedVersion",
    p.applied_published_projection_hash AS "appliedPublishedProjectionHash",
    CASE WHEN p.applied_operation_id IS NULL THEN NULL ELSE json_build_object(
      'operationId', p.applied_operation_id,
      'status', applied_receipt.status,
      'commandKind', applied_receipt.command_kind,
      'origin', applied_receipt.origin,
      'completedSteps', applied_receipt.completed_steps
    ) END AS "appliedReceipt",
    CASE WHEN latest_receipt.operation_id IS NULL THEN NULL ELSE json_build_object(
      'operationId', latest_receipt.operation_id,
      'status', latest_receipt.status,
      'commandKind', latest_receipt.command_kind,
      'origin', latest_receipt.origin,
      'completedSteps', latest_receipt.completed_steps,
      'inputHashes', latest_receipt.input_hashes
    ) END AS "latestReceipt",
    d.content AS "draftContent",
    pub.content AS "publishedContent",
    pub.version AS "publishedVersion",
    coalesce(a.assets, '[]'::json) AS assets,
    ${projectionSelect}
  FROM public.invitations i
  LEFT JOIN public.managed_invitation_release_provenance p ON p.invitation_id = i.id
  LEFT JOIN public.invitation_mutation_operation_receipts applied_receipt
    ON applied_receipt.operation_id = p.applied_operation_id
  LEFT JOIN LATERAL (
    SELECT d0.content
    FROM public.invitation_content_drafts d0
    WHERE d0.invitation_project_id = i.id AND d0.deleted_at IS NULL
    ORDER BY d0.updated_at DESC
    LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT p0.content, p0.version
    FROM public.published_invitation_content p0
    WHERE p0.invitation_project_id = i.id AND p0.deleted_at IS NULL
    ORDER BY p0.version DESC
    LIMIT 1
  ) pub ON true
  LEFT JOIN LATERAL (
    SELECT r.operation_id, r.status, r.command_kind, r.origin, r.completed_steps, r.input_hashes
    FROM public.invitation_mutation_operation_receipts r
    WHERE r.invitation_id = i.id
    ORDER BY r.created_at DESC LIMIT 1
  ) latest_receipt ON true
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
      'id', ia.id,
      'managedSourceKey', ia.managed_source_key,
      'managedSha256', ia.managed_sha256,
      'sha256', ia.sha256,
      'displayName', ia.display_name,
      'mimeType', ia.mime_type,
      'width', ia.width,
      'height', ia.height,
      'fileSize', ia.file_size
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
	options: PromotionalEvidenceOptions = {},
): Promise<GroupedPromotionalEvidence> {
	if (slugs.length === 0) {
		return { ok: true, rows: [], activeInvitationRows: 0, identityConflictsCount: 0 };
	}
	const sql = buildGroupedPromotionalEvidenceSql(slugs, options);
	const result = await session.psql(sql, dbUrl, { tuplesOnly: true });
	if (result.status !== 0) {
		return {
			ok: false,
			failure: 'query_failed',
			rows: [],
			activeInvitationRows: 0,
			identityConflictsCount: 0,
		};
	}
	try {
		const parsed = parseJsonValue(result.stdout);
		if (Array.isArray(parsed)) {
			return {
				ok: true,
				rows: parsed
					.map(parseRow)
					.filter((row): row is LiveInvitationEvidenceRow => Boolean(row)),
				activeInvitationRows: 0,
				identityConflictsCount: 0,
			};
		}
		if (!parsed || typeof parsed !== 'object') {
			return {
				ok: false,
				failure: 'query_failed',
				rows: [],
				activeInvitationRows: 0,
				identityConflictsCount: 0,
			};
		}
		const payload = parsed as Record<string, unknown>;
		const rowsRaw = Array.isArray(payload.rows) ? payload.rows : [];
		return {
			ok: true,
			rows: rowsRaw
				.map(parseRow)
				.filter((row): row is LiveInvitationEvidenceRow => Boolean(row)),
			activeInvitationRows: numberOrNull(payload.activeInvitationRows) ?? 0,
			identityConflictsCount: numberOrNull(payload.identityConflictsCount) ?? 0,
		};
	} catch {
		return {
			ok: false,
			failure: 'query_failed',
			rows: [],
			activeInvitationRows: 0,
			identityConflictsCount: 0,
		};
	}
}
