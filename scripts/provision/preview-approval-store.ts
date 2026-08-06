/**
 * preview-approval-store.ts — Storage seam for Preview release approvals.
 *
 * Default runtime store is Preview DB (shared across worktrees). Tests inject
 * an in-memory store. No app runtime, Vercel, or Cloudinary involvement.
 */
import { assertPreviewDbUrl, getPreviewDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import type { PreviewApprovalArtifact } from './preview-approval-service.ts';

export interface PreviewApprovalStore {
	get(packageHash: string): PreviewApprovalArtifact | null;
	upsert(artifact: PreviewApprovalArtifact): PreviewApprovalArtifact;
}

type ApprovalRow = {
	package_hash: string;
	slug: string;
	route: string;
	approval_state: PreviewApprovalArtifact['approvalState'];
	schema_version: string;
	source_hash: string;
	metadata_hash: string;
	canonical_projection_hash: string;
	materialized_projection_hash: string;
	asset_manifest_hash: string;
	plan_id: string | null;
	preview_project_ref: string;
	intended_production_project_ref: string | null;
	expected_asset_hashes: Record<string, string> | string;
	hosted_validation: PreviewApprovalArtifact['hostedValidation'] | string | null;
	created_at: string;
	approved_at: string | null;
	approved_by: string | null;
};

function parseJsonField<T>(value: T | string | null | undefined, fallback: T): T {
	if (value == null) return fallback;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return fallback;
		}
	}
	return value;
}

export function rowToArtifact(row: ApprovalRow): PreviewApprovalArtifact {
	const artifact: PreviewApprovalArtifact = {
		packageHash: row.package_hash,
		slug: row.slug,
		route: row.route,
		approvalState: row.approval_state,
		schemaVersion: row.schema_version as PreviewApprovalArtifact['schemaVersion'],
		sourceHash: row.source_hash,
		metadataHash: row.metadata_hash,
		canonicalProjectionHash: row.canonical_projection_hash,
		materializedProjectionHash: row.materialized_projection_hash,
		assetManifestHash: row.asset_manifest_hash,
		previewProjectRef: row.preview_project_ref,
		createdAt: row.created_at,
		expectedAssetHashes: parseJsonField(row.expected_asset_hashes, {}),
	};
	if (row.plan_id) artifact.planId = row.plan_id;
	if (row.intended_production_project_ref) {
		artifact.intendedProductionProjectRef = row.intended_production_project_ref;
	}
	if (row.approved_at) artifact.approvedAt = row.approved_at;
	if (row.approved_by) artifact.approvedBy = row.approved_by;
	const hosted = parseJsonField<PreviewApprovalArtifact['hostedValidation'] | null>(
		row.hosted_validation,
		null,
	);
	if (hosted) artifact.hostedValidation = hosted;
	return artifact;
}

export function createMemoryPreviewApprovalStore(
	seed: PreviewApprovalArtifact[] = [],
): PreviewApprovalStore {
	const map = new Map<string, PreviewApprovalArtifact>();
	for (const artifact of seed) {
		map.set(artifact.packageHash, structuredClone(artifact));
	}
	return {
		get(packageHash) {
			const hit = map.get(packageHash);
			return hit ? structuredClone(hit) : null;
		},
		upsert(artifact) {
			const copy = structuredClone(artifact);
			map.set(copy.packageHash, copy);
			return structuredClone(copy);
		},
	};
}

function resolvePreviewDbUrl(): string {
	const { url } = getPreviewDbUrl();
	assertPreviewDbUrl(url);
	return url;
}

function queryRowJson(sql: string, dbUrl: string): ApprovalRow | null {
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	const raw = result.stdout.trim();
	if (!raw || raw === 'null') return null;
	return JSON.parse(raw) as ApprovalRow;
}

const SELECT_COLS = `
  package_hash, slug, route, approval_state, schema_version,
  source_hash, metadata_hash, canonical_projection_hash,
  materialized_projection_hash, asset_manifest_hash, plan_id,
  preview_project_ref, intended_production_project_ref,
  expected_asset_hashes, hosted_validation, created_at,
  approved_at, approved_by
`;

export function createPreviewDbApprovalStore(
	options: {
		getDbUrl?: () => string;
		queryRow?: (sql: string, dbUrl: string) => ApprovalRow | null;
	} = {},
): PreviewApprovalStore {
	const getDbUrl = options.getDbUrl ?? resolvePreviewDbUrl;
	const queryRow = options.queryRow ?? queryRowJson;

	return {
		get(packageHash) {
			const row = queryRow(
				`select row_to_json(t) from (
           select ${SELECT_COLS}
           from public.preview_approval_artifacts
           where package_hash = ${sqlLiteral(packageHash)}
           limit 1
         ) t;`,
				getDbUrl(),
			);
			return row ? rowToArtifact(row) : null;
		},
		upsert(artifact) {
			const hostedJson = artifact.hostedValidation
				? `${sqlLiteral(JSON.stringify(artifact.hostedValidation))}::jsonb`
				: 'null::jsonb';
			const intended = artifact.intendedProductionProjectRef
				? sqlLiteral(artifact.intendedProductionProjectRef)
				: 'null';
			const approvedAt = artifact.approvedAt
				? `${sqlLiteral(artifact.approvedAt)}::timestamptz`
				: 'null::timestamptz';
			const approvedBy = artifact.approvedBy ? sqlLiteral(artifact.approvedBy) : 'null';
			const planId = artifact.planId ? sqlLiteral(artifact.planId) : 'null';
			const row = queryRow(
				`select row_to_json(t) from (
           insert into public.preview_approval_artifacts (
             package_hash, slug, route, approval_state, schema_version,
             source_hash, metadata_hash, canonical_projection_hash,
             materialized_projection_hash, asset_manifest_hash, plan_id,
             preview_project_ref, intended_production_project_ref,
             expected_asset_hashes, hosted_validation, created_at,
             approved_at, approved_by, expires_at
           ) values (
             ${sqlLiteral(artifact.packageHash)},
             ${sqlLiteral(artifact.slug)},
             ${sqlLiteral(artifact.route)},
             ${sqlLiteral(artifact.approvalState)},
             ${sqlLiteral(artifact.schemaVersion)},
             ${sqlLiteral(artifact.sourceHash)},
             ${sqlLiteral(artifact.metadataHash)},
             ${sqlLiteral(artifact.canonicalProjectionHash)},
             ${sqlLiteral(artifact.materializedProjectionHash)},
             ${sqlLiteral(artifact.assetManifestHash)},
             ${planId},
             ${sqlLiteral(artifact.previewProjectRef)},
             ${intended},
             ${sqlLiteral(JSON.stringify(artifact.expectedAssetHashes ?? {}))}::jsonb,
             ${hostedJson},
             ${sqlLiteral(artifact.createdAt)}::timestamptz,
             ${approvedAt},
             ${approvedBy},
             (${sqlLiteral(artifact.createdAt)}::timestamptz + interval '7 days')
           )
           on conflict (package_hash) do update set
             slug = excluded.slug,
             route = excluded.route,
             approval_state = excluded.approval_state,
             schema_version = excluded.schema_version,
             source_hash = excluded.source_hash,
             metadata_hash = excluded.metadata_hash,
             canonical_projection_hash = excluded.canonical_projection_hash,
             materialized_projection_hash = excluded.materialized_projection_hash,
             asset_manifest_hash = excluded.asset_manifest_hash,
             plan_id = excluded.plan_id,
             preview_project_ref = excluded.preview_project_ref,
             intended_production_project_ref = excluded.intended_production_project_ref,
             expected_asset_hashes = excluded.expected_asset_hashes,
             hosted_validation = excluded.hosted_validation,
             created_at = excluded.created_at,
             approved_at = excluded.approved_at,
             approved_by = excluded.approved_by,
             expires_at = excluded.expires_at
           returning ${SELECT_COLS}
         ) t;`,
				getDbUrl(),
			);
			if (!row) {
				throw new Error(
					`Failed to upsert preview approval for package ${artifact.packageHash}.`,
				);
			}
			return rowToArtifact(row);
		},
	};
}

let defaultStore: PreviewApprovalStore | null = null;

export function getDefaultPreviewApprovalStore(): PreviewApprovalStore {
	if (!defaultStore) {
		defaultStore = createPreviewDbApprovalStore();
	}
	return defaultStore;
}

/** Test-only seam to avoid Preview DB I/O. */
export function setDefaultPreviewApprovalStoreForTests(store: PreviewApprovalStore | null): void {
	defaultStore = store;
}
