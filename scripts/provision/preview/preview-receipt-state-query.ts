/**
 * Query builder and raw state parsing for Preview provenance receipt inspection.
 */
import { runPsql, sqlLiteral } from '../../db/db-workflow-lib.ts';
import type { ManagedBaselineReceiptEvidence } from '../managed-merge-baseline.ts';

type ReceiptStatus = ManagedBaselineReceiptEvidence['status'];

export interface ReceiptRow extends ManagedBaselineReceiptEvidence {
	createdAt?: string;
	expectedState?: Record<string, unknown>;
	result?: Record<string, unknown>;
}

export interface PreviewAssetRow {
	id: string;
	display_name: string;
	storage_path: string;
	bucket: string | null;
	mime_type: string | null;
	width: number | null;
	height: number | null;
	file_size: number | null;
	validation_version: number | null;
	original_mime_type: string | null;
	original_file_size: number | null;
	default_alt_text: string | null;
	provider: string | null;
	provider_public_id: string | null;
	provider_version: string | null;
	secure_url: string | null;
	sha256: string | null;
	managed_by_definition_slug: string | null;
	managed_source_key: string | null;
	managed_sha256: string | null;
	managed_operation_id: string | null;
}

export interface PreviewReceiptState {
	invitation: {
		id: string;
		slug: string;
		managed_identity_id: string | null;
		updated_at: string | null;
		status: string | null;
		archived_at: string | null;
	};
	draft: { updated_at: string; content: Record<string, unknown> } | null;
	published: { version: number; content: Record<string, unknown> } | null;
	provenance: {
		definition_slug: string;
		managed_identity_id: string | null;
		previous_slugs: string[];
		release_schema_version: string;
		source_hash: string;
		package_hash: string;
		metadata_hash: string;
		projection_hash: string;
		asset_manifest_hash: string;
		managed_projection: Record<string, unknown> | null;
		applied_draft_updated_at: string | null;
		applied_operation_id: string | null;
		applied_published_version: number | null;
		applied_published_projection_hash: string | null;
	} | null;
	appliedReceipt: ReceiptRow | null;
	latestReceipt: ReceiptRow | null;
	assets: PreviewAssetRow[];
}

export function parseJson(stdout: string): Record<string, unknown> | null {
	const trimmed = stdout.trim();
	if (!trimmed || trimmed === 'null') return null;
	const start = trimmed.indexOf('{');
	const end = trimmed.lastIndexOf('}');
	if (start < 0 || end < start) throw new Error('Preview receipt query did not return JSON.');
	return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

export function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

export function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseReceipt(value: unknown): ReceiptRow | null {
	const row = record(value);
	const operationId = stringOrNull(row?.operation_id);
	const status = stringOrNull(row?.status) as ReceiptStatus | null;
	const commandKind = stringOrNull(row?.command_kind);
	if (
		!operationId ||
		!commandKind ||
		!status ||
		!['not_applied', 'applied', 'partial', 'replayed'].includes(status)
	)
		return null;
	return {
		operationId,
		status,
		commandKind,
		origin: stringOrNull(row?.origin) ?? undefined,
		completedSteps: Array.isArray(row?.completed_steps)
			? row!.completed_steps.filter((step): step is string => typeof step === 'string')
			: [],
		inputHashes: record(row?.input_hashes) ?? undefined,
		expectedState: record(row?.expected_state) ?? undefined,
		result: record(row?.result) ?? undefined,
		createdAt: stringOrNull(row?.created_at) ?? undefined,
	};
}

export function parseAsset(value: unknown): PreviewAssetRow | null {
	const row = record(value);
	if (
		!row ||
		typeof row.id !== 'string' ||
		typeof row.display_name !== 'string' ||
		typeof row.storage_path !== 'string'
	)
		return null;
	return {
		id: row.id,
		display_name: row.display_name,
		storage_path: row.storage_path,
		bucket: stringOrNull(row.bucket),
		mime_type: stringOrNull(row.mime_type),
		width: numberOrNull(row.width),
		height: numberOrNull(row.height),
		file_size: numberOrNull(row.file_size),
		validation_version: numberOrNull(row.validation_version),
		original_mime_type: stringOrNull(row.original_mime_type),
		original_file_size: numberOrNull(row.original_file_size),
		default_alt_text: stringOrNull(row.default_alt_text),
		provider: stringOrNull(row.provider),
		provider_public_id: stringOrNull(row.provider_public_id),
		provider_version: stringOrNull(row.provider_version),
		secure_url: stringOrNull(row.secure_url),
		sha256: stringOrNull(row.sha256),
		managed_by_definition_slug: stringOrNull(row.managed_by_definition_slug),
		managed_source_key: stringOrNull(row.managed_source_key),
		managed_sha256: stringOrNull(row.managed_sha256),
		managed_operation_id: stringOrNull(row.managed_operation_id),
	};
}

// eslint-disable-next-line complexity -- Parse each bounded nullable database component fail-closed.
export function parsePreviewReceiptState(value: Record<string, unknown>): PreviewReceiptState {
	const invitation = record(value.invitation);
	if (value.invitationCount !== 1)
		throw new Error(
			'Preview receipt inspection requires exactly one active client invitation for this slug.',
		);
	if (!invitation || typeof invitation.id !== 'string' || typeof invitation.slug !== 'string')
		throw new Error('Preview has no unique active invitation for this slug.');
	const draft = record(value.draft);
	const published = record(value.published);
	const provenance = record(value.provenance);
	return {
		invitation: {
			id: invitation.id,
			slug: invitation.slug,
			managed_identity_id: stringOrNull(invitation.managed_identity_id),
			updated_at: stringOrNull(invitation.updated_at),
			status: stringOrNull(invitation.status),
			archived_at: stringOrNull(invitation.archived_at),
		},
		draft:
			draft && typeof draft.updated_at === 'string' && record(draft.content)
				? {
						updated_at: draft.updated_at,
						content: draft.content as Record<string, unknown>,
					}
				: null,
		published:
			published && typeof published.version === 'number' && record(published.content)
				? {
						version: published.version,
						content: published.content as Record<string, unknown>,
					}
				: null,
		provenance:
			provenance && typeof provenance.definition_slug === 'string'
				? {
						definition_slug: provenance.definition_slug,
						managed_identity_id: stringOrNull(provenance.managed_identity_id),
						previous_slugs: Array.isArray(provenance.previous_slugs)
							? provenance.previous_slugs.filter(
									(item): item is string => typeof item === 'string',
								)
							: [],
						release_schema_version: String(provenance.release_schema_version ?? ''),
						source_hash: String(provenance.source_hash ?? ''),
						package_hash: String(provenance.package_hash ?? ''),
						metadata_hash: String(provenance.metadata_hash ?? ''),
						projection_hash: String(provenance.projection_hash ?? ''),
						asset_manifest_hash: String(provenance.asset_manifest_hash ?? ''),
						managed_projection: record(provenance.managed_projection),
						applied_draft_updated_at: stringOrNull(provenance.applied_draft_updated_at),
						applied_operation_id: stringOrNull(provenance.applied_operation_id),
						applied_published_version: numberOrNull(
							provenance.applied_published_version,
						),
						applied_published_projection_hash: stringOrNull(
							provenance.applied_published_projection_hash,
						),
					}
				: null,
		appliedReceipt: parseReceipt(value.appliedReceipt),
		latestReceipt: parseReceipt(value.latestReceipt),
		assets: Array.isArray(value.assets)
			? value.assets
					.map(parseAsset)
					.filter((asset): asset is PreviewAssetRow => Boolean(asset))
			: [],
	};
}

export function buildReadOnlyQuery(slug: string): string {
	const safeSlug = sqlLiteral(slug);
	return `
select json_build_object(
  'invitationCount', (select count(*) from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client'),
  'invitation', (select row_to_json(i) from (select id::text, slug, managed_identity_id::text, updated_at::text, status, archived_at::text from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' order by id limit 1) i),
  'draft', (select row_to_json(d) from (select updated_at::text, content from public.invitation_content_drafts where invitation_project_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1) and deleted_at is null order by updated_at desc limit 1) d),
  'published', (select row_to_json(p) from (select version, content from public.published_invitation_content where invitation_project_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1) and deleted_at is null order by version desc limit 1) p),
  'provenance', (select row_to_json(p) from (select definition_slug, managed_identity_id::text, previous_slugs, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, managed_projection, applied_draft_updated_at::text, applied_operation_id::text, applied_published_version, applied_published_projection_hash from public.managed_invitation_release_provenance where invitation_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1)) p),
  'appliedReceipt', (select row_to_json(r) from (select r.operation_id::text, r.status, r.command_kind, r.origin, r.completed_steps, r.input_hashes, r.expected_state, r.result, r.created_at::text from public.invitation_mutation_operation_receipts r join public.managed_invitation_release_provenance p on p.applied_operation_id = r.operation_id where p.invitation_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1) limit 1) r),
  'latestReceipt', (select row_to_json(r) from (select operation_id::text, status, command_kind, origin, completed_steps, input_hashes, expected_state, result, created_at::text from public.invitation_mutation_operation_receipts where invitation_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1) order by created_at desc, id desc limit 1) r),
  'assets', coalesce((select json_agg(a order by a.managed_source_key, a.id) from (select id::text, display_name, storage_path, bucket, mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size, default_alt_text, provider, provider_public_id, provider_version, secure_url, sha256, managed_by_definition_slug, managed_source_key, managed_sha256, managed_operation_id::text from public.invitation_assets where invitation_id = (select id from public.invitations where slug = ${safeSlug} and archived_at is null and kind = 'client' limit 1) and deleted_at is null) a), '[]'::json)
);`;
}

export function queryPreviewReceiptState(slug: string, dbUrl: string): PreviewReceiptState {
	const row = parseJson(runPsql(buildReadOnlyQuery(slug), dbUrl, { tuplesOnly: true }).stdout);
	if (!row) throw new Error('Preview receipt inspection returned no invitation.');
	return parsePreviewReceiptState(row);
}
