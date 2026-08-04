/**
 * Stable read-only observability projection. One content query and one migration query are
 * permitted per environment; repository-to-environment reconciliation remains in TypeScript.
 */
import { Buffer } from 'node:buffer';
import { classifyDbTarget } from '../db/db-guard.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import type { SchemaLifecycleState } from '../db/schema-lifecycle-state.ts';
import {
	StatusProbeSession,
	readMigrationLifecycleForUrlSync,
} from '../status-core/index.ts';
import { resolveDbUrlForEnv, type TargetEnv } from '../provision/dbs-status.ts';
import type { ManagedBaselineReceiptEvidence } from '../provision/managed-merge-baseline.ts';

export const OBSERVABILITY_MAX_DB_INVOCATIONS = 6;
export const OBSERVABILITY_DETAIL_BUDGET_BYTES = 256 * 1024;

export class ObservabilityInvocationBudget {
	#used = 0;

	consume(): void {
		if (this.#used >= OBSERVABILITY_MAX_DB_INVOCATIONS) {
			throw new Error('OBSERVABILITY_DB_INVOCATION_BUDGET_EXCEEDED');
		}
		this.#used += 1;
	}

	get used(): number {
		return this.#used;
	}
}

export interface ManagedAssetProjection {
	id: string;
	key: string | null;
	displayName: string | null;
	mimeType: string | null;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}

export interface InvitationDatabaseProjection {
	slug: string;
	invitationId: string;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	draftContent: Record<string, unknown> | null;
	/** Published content is the canonical present-state target for approved drafts. */
	publishedContent?: Record<string, unknown> | null;
	detailRequired: boolean;
	detailBudgetExceeded: boolean;
	publishedVersion: number | null;
	publishedAt: string | null;
	assetCount: number;
	managedAssetKeys: string[];
	managedAssets: ManagedAssetProjection[];
	metadata: {
		eventType: string | null;
		kind: string | null;
		baseDemoId: string | null;
		themeId: string | null;
		snapshot: Record<string, unknown> | null;
		clientName: string | null;
		createdBy: string | null;
	};
	event: { slug: string | null; eventType: string | null; ownerUserId: string | null };
	provenance: {
		definitionSlug: string | null;
		releaseSchemaVersion: string | null;
		packageHash: string | null;
		managedProjection: Record<string, unknown> | null;
		hasManagedProjection: boolean;
		appliedDraftUpdatedAt: string | null;
		appliedOperationId: string | null;
		appliedPublishedVersion: number | null;
		appliedPublishedProjectionHash: string | null;
		appliedReceipt: ManagedBaselineReceiptEvidence | null;
		latestReceipt: ManagedBaselineReceiptEvidence | null;
	};
}

export interface EnvironmentDatabaseProjection {
	environment: TargetEnv;
	configured: boolean;
	reachable: boolean;
	targetClassification: string;
	activeInvitationRows: number;
	identityConflictsCount: number;
	rows: InvitationDatabaseProjection[];
	failure: 'credentials_required' | 'query_failed' | null;
}

export interface MigrationProjection {
	environment: TargetEnv;
	available: boolean;
	schemaLifecycle: SchemaLifecycleState;
	appliedCount: number | null;
	pendingCount: number;
	/** Exact missing repository migration version IDs; required for SCHEMA_BEHIND. */
	pendingMigrations: string[];
	/** Exact remote-only migration version IDs; used for SCHEMA_DRIFT evidence. */
	extraMigrations: string[];
}

export function unprobedEnvironmentProjection(
	environment: TargetEnv,
): EnvironmentDatabaseProjection {
	return {
		environment,
		configured: false,
		reachable: false,
		targetClassification: 'unknown',
		activeInvitationRows: 0,
		identityConflictsCount: 0,
		rows: [],
		failure: 'credentials_required',
	};
}

export function unprobedMigrationProjection(environment: TargetEnv): MigrationProjection {
	return {
		environment,
		available: false,
		schemaLifecycle: 'UNVERIFIED',
		appliedCount: null,
		pendingCount: 0,
		pendingMigrations: [],
		extraMigrations: [],
	};
}

interface RawProjectionPayload {
	activeInvitationRows?: unknown;
	identityConflictsCount?: unknown;
	rows?: unknown;
}

function decodeRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== 'string' || !value) return null;
	try {
		const parsed: unknown = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
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
			row.inputHashes &&
			typeof row.inputHashes === 'object' &&
			!Array.isArray(row.inputHashes)
				? (row.inputHashes as Record<string, unknown>)
				: undefined,
	};
}

function managedAssets(value: unknown): ManagedAssetProjection[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
		const row = item as Record<string, unknown>;
		const id = stringOrNull(row.id);
		if (!id) return [];
		return [
			{
				id,
				key: stringOrNull(row.key),
				displayName: stringOrNull(row.displayName),
				mimeType: stringOrNull(row.mimeType),
				width: numberOrNull(row.width),
				height: numberOrNull(row.height),
				fileSize: numberOrNull(row.fileSize),
			},
		];
	});
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort();
}

function parseRows(value: unknown): InvitationDatabaseProjection[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
		const row = item as Record<string, unknown>;
		const slug = stringOrNull(row.slug);
		const invitationId = stringOrNull(row.invitationId);
		if (!slug || !invitationId) return [];
		const provenance =
			row.provenance && typeof row.provenance === 'object' && !Array.isArray(row.provenance)
				? (row.provenance as Record<string, unknown>)
				: {};
		const metadata = isRecord(row.metadata) ? row.metadata : {};
		const event = isRecord(row.event) ? row.event : {};
		return [
			{
				slug,
				invitationId,
				draftStatus: stringOrNull(row.draftStatus),
				draftUpdatedAt: stringOrNull(row.draftUpdatedAt),
				draftContent: decodeRecord(row.draftContentBase64),
				publishedContent: decodeRecord(row.publishedContentBase64),
				detailRequired: row.detailRequired === true,
				detailBudgetExceeded: row.detailBudgetExceeded === true,
				publishedVersion: numberOrNull(row.publishedVersion),
				publishedAt: stringOrNull(row.publishedAt),
				assetCount: numberOrNull(row.assetCount) ?? 0,
				managedAssetKeys: stringArray(row.managedAssetKeys),
				managedAssets: managedAssets(row.managedAssets),
				metadata: {
					eventType: stringOrNull(metadata.eventType),
					kind: stringOrNull(metadata.kind),
					baseDemoId: stringOrNull(metadata.baseDemoId),
					themeId: stringOrNull(metadata.themeId),
					snapshot: isRecord(metadata.snapshot) ? metadata.snapshot : null,
					clientName: stringOrNull(metadata.clientName),
					createdBy: stringOrNull(metadata.createdBy),
				},
				event: {
					slug: stringOrNull(event.slug),
					eventType: stringOrNull(event.eventType),
					ownerUserId: stringOrNull(event.ownerUserId),
				},
				provenance: {
					definitionSlug: stringOrNull(provenance.definitionSlug),
					releaseSchemaVersion: stringOrNull(provenance.releaseSchemaVersion),
					packageHash: stringOrNull(provenance.packageHash),
					managedProjection: decodeRecord(provenance.managedProjectionBase64),
					hasManagedProjection: provenance.hasManagedProjection === true,
					appliedDraftUpdatedAt: stringOrNull(provenance.appliedDraftUpdatedAt),
					appliedOperationId: stringOrNull(provenance.appliedOperationId),
					appliedPublishedVersion: numberOrNull(provenance.appliedPublishedVersion),
					appliedPublishedProjectionHash: stringOrNull(
						provenance.appliedPublishedProjectionHash,
					),
					appliedReceipt: receipt(provenance.appliedReceipt),
					latestReceipt: receipt(provenance.latestReceipt),
				},
			},
		];
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOnlyPsql(sql: string, dbUrl: string, timeoutMs: number) {
	return runPsql(sql, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs,
		env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
	});
}

export function readEnvironmentDatabaseProjection(input: {
	environment: TargetEnv;
	slugs: readonly string[];
	timeoutMs: number;
	budget: ObservabilityInvocationBudget;
}): EnvironmentDatabaseProjection {
	const { dbUrl } = resolveDbUrlForEnv(input.environment);
	if (!dbUrl) {
		return unprobedEnvironmentProjection(input.environment);
	}

	const classification = classifyDbTarget(dbUrl);
	const slugList = [...new Set(input.slugs)].map(sqlLiteral).join(', ');
	const sql = `
WITH target_rows AS (
  SELECT i.*
  FROM public.invitations i
  WHERE i.archived_at IS NULL AND i.slug IN (${slugList || "''"})
), projected AS (
  SELECT
    i.slug,
    i.id,
	 i.event_type AS invitation_event_type,
	 i.kind,
	 i.base_demo_id,
	 i.theme_id,
	 i.snapshot,
	 i.client_name,
	 i.created_by,
	 event.slug AS event_slug,
	 event.event_type AS event_type,
	 event.owner_user_id AS event_owner_user_id,
    d.status AS draft_status,
    d.updated_at AS draft_updated_at,
    pub.version AS published_version,
    pub.published_at,
    p.definition_slug,
    p.release_schema_version,
    p.package_hash,
    p.managed_projection,
    p.applied_draft_updated_at,
    p.applied_operation_id,
    p.applied_published_version,
    p.applied_published_projection_hash,
    applied_receipt.status AS applied_receipt_status,
    applied_receipt.command_kind AS applied_receipt_command_kind,
    applied_receipt.origin AS applied_receipt_origin,
    applied_receipt.completed_steps AS applied_receipt_completed_steps,
    latest_receipt.operation_id AS latest_receipt_operation_id,
    latest_receipt.status AS latest_receipt_status,
    latest_receipt.command_kind AS latest_receipt_command_kind,
    latest_receipt.origin AS latest_receipt_origin,
    latest_receipt.completed_steps AS latest_receipt_completed_steps,
    latest_receipt.input_hashes AS latest_receipt_input_hashes,
    COALESCE(assets.asset_count, 0) AS asset_count,
	COALESCE(assets.keys, '[]'::jsonb) AS managed_asset_keys,
    COALESCE(assets.items, '[]'::jsonb) AS managed_assets,
	-- Direct alignment needs the current managed projection even when durable provenance exists.
	true AS detail_required,
    COALESCE(octet_length(d.content::text), 0) +
	  COALESCE(octet_length(pub.content::text), 0) +
	  COALESCE(octet_length(p.managed_projection::text), 0) +
	  COALESCE(octet_length(assets.items::text), 0) AS detail_bytes,
    d.content AS draft_content,
    pub.content AS published_content
  FROM target_rows i
  LEFT JOIN public.managed_invitation_release_provenance p ON p.invitation_id = i.id
  LEFT JOIN public.invitation_mutation_operation_receipts applied_receipt
    ON applied_receipt.operation_id = p.applied_operation_id
  LEFT JOIN LATERAL (
    SELECT d0.status, d0.updated_at, d0.content
    FROM public.invitation_content_drafts d0
    WHERE d0.invitation_project_id = i.id AND d0.deleted_at IS NULL
    ORDER BY d0.updated_at DESC LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT p0.version, p0.published_at, p0.content
    FROM public.published_invitation_content p0
    WHERE p0.invitation_project_id = i.id AND p0.deleted_at IS NULL
    ORDER BY p0.version DESC LIMIT 1
  ) pub ON true
  LEFT JOIN LATERAL (
    SELECT r.operation_id, r.status, r.command_kind, r.origin, r.completed_steps, r.input_hashes
    FROM public.invitation_mutation_operation_receipts r
    WHERE r.invitation_id = i.id
    ORDER BY r.created_at DESC LIMIT 1
  ) latest_receipt ON true
  LEFT JOIN LATERAL (
	 SELECT e.slug, e.event_type, e.owner_user_id
	 FROM public.events e
	 WHERE e.invitation_project_id = i.id AND e.deleted_at IS NULL
	 ORDER BY e.id LIMIT 1
  ) event ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS asset_count,
	  jsonb_agg(a.managed_source_key ORDER BY a.managed_source_key)
	    FILTER (WHERE a.managed_source_key IS NOT NULL) AS keys,
      jsonb_agg(jsonb_build_object(
        'id', a.id,
        'key', a.managed_source_key,
		'displayName', a.display_name,
		'mimeType', a.mime_type,
		'width', a.width,
		'height', a.height,
		'fileSize', a.file_size
      ) ORDER BY a.id) AS items
    FROM public.invitation_assets a
    WHERE a.invitation_id = i.id AND a.deleted_at IS NULL
  ) assets ON true
)
SELECT jsonb_build_object(
  'activeInvitationRows', (SELECT COUNT(*) FROM public.invitations WHERE archived_at IS NULL),
  'identityConflictsCount', (
    SELECT COALESCE(SUM(count_for_slug - 1), 0)
    FROM (
      SELECT COUNT(*) AS count_for_slug
      FROM public.invitations WHERE archived_at IS NULL
      GROUP BY slug HAVING COUNT(*) > 1
    ) conflicts
  ),
  'rows', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'slug', slug,
      'invitationId', id,
      'draftStatus', draft_status,
      'draftUpdatedAt', draft_updated_at,
      'draftContentBase64', CASE
        WHEN detail_required AND detail_bytes <= ${OBSERVABILITY_DETAIL_BUDGET_BYTES}
        THEN encode(convert_to(draft_content::text, 'UTF8'), 'base64') ELSE NULL END,
      'publishedContentBase64', CASE
        WHEN detail_required AND detail_bytes <= ${OBSERVABILITY_DETAIL_BUDGET_BYTES}
        THEN encode(convert_to(published_content::text, 'UTF8'), 'base64') ELSE NULL END,
      'detailRequired', detail_required,
      'detailBudgetExceeded', detail_required AND detail_bytes > ${OBSERVABILITY_DETAIL_BUDGET_BYTES},
      'publishedVersion', published_version,
      'publishedAt', published_at,
      'assetCount', asset_count,
	  'managedAssetKeys', managed_asset_keys,
      'managedAssets', CASE
        WHEN detail_required AND detail_bytes <= ${OBSERVABILITY_DETAIL_BUDGET_BYTES}
        THEN managed_assets ELSE '[]'::jsonb END,
	  'metadata', jsonb_build_object(
		'eventType', invitation_event_type,
		'kind', kind,
		'baseDemoId', base_demo_id,
		'themeId', theme_id,
		'snapshot', snapshot,
		'clientName', client_name,
		'createdBy', created_by
	  ),
	  'event', jsonb_build_object(
		'slug', event_slug,
		'eventType', event_type,
		'ownerUserId', event_owner_user_id
	  ),
      'provenance', jsonb_build_object(
        'definitionSlug', definition_slug,
        'releaseSchemaVersion', release_schema_version,
        'packageHash', package_hash,
		'hasManagedProjection', (
			managed_projection IS NOT NULL
			AND jsonb_typeof(managed_projection) = 'object'
			AND managed_projection <> '{}'::jsonb
		),
        'managedProjectionBase64', CASE
          WHEN detail_required AND detail_bytes <= ${OBSERVABILITY_DETAIL_BUDGET_BYTES}
          THEN encode(convert_to(managed_projection::text, 'UTF8'), 'base64') ELSE NULL END,
        'appliedDraftUpdatedAt', applied_draft_updated_at,
        'appliedOperationId', applied_operation_id,
        'appliedPublishedVersion', applied_published_version,
        'appliedPublishedProjectionHash', applied_published_projection_hash,
        'appliedReceipt', CASE WHEN applied_operation_id IS NULL THEN NULL ELSE jsonb_build_object(
          'operationId', applied_operation_id,
          'status', applied_receipt_status,
          'commandKind', applied_receipt_command_kind,
          'origin', applied_receipt_origin,
          'completedSteps', applied_receipt_completed_steps
        ) END,
        'latestReceipt', CASE WHEN latest_receipt_operation_id IS NULL THEN NULL ELSE jsonb_build_object(
          'operationId', latest_receipt_operation_id,
          'status', latest_receipt_status,
          'commandKind', latest_receipt_command_kind,
          'origin', latest_receipt_origin,
          'completedSteps', latest_receipt_completed_steps,
          'inputHashes', latest_receipt_input_hashes
        ) END
      )
    ) ORDER BY slug, id)
    FROM projected
  ), '[]'::jsonb)
)::text;`.trim();

	input.budget.consume();
	const result = readOnlyPsql(sql, dbUrl, input.timeoutMs);
	if (result.status !== 0 || !result.stdout.trim()) {
		return {
			environment: input.environment,
			configured: true,
			reachable: false,
			targetClassification: classification.target,
			activeInvitationRows: 0,
			identityConflictsCount: 0,
			rows: [],
			failure: 'query_failed',
		};
	}

	try {
		const parsed = JSON.parse(result.stdout.trim()) as RawProjectionPayload;
		return {
			environment: input.environment,
			configured: true,
			reachable: true,
			targetClassification: classification.target,
			activeInvitationRows: numberOrNull(parsed.activeInvitationRows) ?? 0,
			identityConflictsCount: numberOrNull(parsed.identityConflictsCount) ?? 0,
			rows: parseRows(parsed.rows),
			failure: null,
		};
	} catch {
		return {
			environment: input.environment,
			configured: true,
			reachable: false,
			targetClassification: classification.target,
			activeInvitationRows: 0,
			identityConflictsCount: 0,
			rows: [],
			failure: 'query_failed',
		};
	}
}

export function readMigrationProjection(input: {
	environment: TargetEnv;
	timeoutMs: number;
	budget: ObservabilityInvocationBudget;
}): MigrationProjection {
	const { dbUrl } = resolveDbUrlForEnv(input.environment);
	if (!dbUrl) {
		return {
			environment: input.environment,
			available: false,
			schemaLifecycle: 'UNVERIFIED',
			appliedCount: null,
			pendingCount: 0,
			pendingMigrations: [],
			extraMigrations: [],
		};
	}

	input.budget.consume();
	try {
		const session = new StatusProbeSession({ timeoutMs: input.timeoutMs });
		const lifecycle = readMigrationLifecycleForUrlSync(dbUrl, session);
		return {
			environment: input.environment,
			available: lifecycle.verified,
			schemaLifecycle: lifecycle.schemaLifecycle,
			appliedCount: lifecycle.appliedMigrationCount,
			pendingCount: lifecycle.pendingMigrations.length,
			pendingMigrations: [...lifecycle.pendingMigrations],
			extraMigrations: [...lifecycle.extraMigrations],
		};
	} catch {
		return {
			environment: input.environment,
			available: false,
			schemaLifecycle: 'UNVERIFIED',
			appliedCount: null,
			pendingCount: 0,
			pendingMigrations: [],
			extraMigrations: [],
		};
	}
}
