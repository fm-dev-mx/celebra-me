/** Read-only Preview receipt inspection and metadata-only stale provenance recovery. */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertPreviewDbUrl, getPreviewDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	canonicalize,
	materializeAssetReferences,
	RELEASE_SCHEMA_VERSION,
} from './normalized-invitation-release.ts';
import type { UploadedAssetRef } from './invitations/invitation-definition.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import { type InvitationPackageAsset, type InvitationPackageData } from './invitation-package.ts';
import { validatePackageData } from './invitation-import-engine.ts';
import {
	diagnoseManagedBaseline,
	type ManagedBaselineDiagnosticClassification,
	type ManagedBaselineReceiptEvidence,
} from './managed-merge-baseline.ts';

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

export interface PreviewReceiptDiagnosis {
	status: 'IN_SYNC' | 'RECOVERABLE' | 'BLOCKED';
	classification: ManagedBaselineDiagnosticClassification;
	recoveryEligible: boolean;
	reasonCode: string;
	invitationId: string | null;
	linkedOperationId: string | null;
	latestOperationId: string | null;
	receipts: {
		linked: ReceiptRow | null;
		latest: ReceiptRow | null;
	};
	completedSteps: {
		linked: string[];
		latest: string[];
	};
	parity: {
		content: { draft: boolean; publication: boolean; managedProjection: boolean };
		assets: boolean;
		assetIdentities: Record<string, { id: string; secureUrl: string | null }>;
		revisions: {
			draftCurrent: string | null;
			draftBaseline: string | null;
			publicationCurrent: number | null;
			publicationBaseline: number | null;
		};
		packageHashes: {
			source: boolean;
			package: boolean;
			metadata: boolean;
			projection: boolean;
			assetManifest: boolean;
		};
		comparableHashes: {
			expectedPublication: string | null;
			currentPublication: string | null;
			expectedDraft: string | null;
			currentDraft: string | null;
			expectedAssetMetadata: string | null;
			currentAssetMetadata: string | null;
		};
	};
	writes: { content: 0; storage: 0; metadata: 0 | 2 };
	blockers: string[];
	message: string;
	nextAction: string;
}

export class PreviewProvenanceRecoveryError extends Error {
	readonly code: 'PREVIEW_RECONCILE_BLOCKED' | 'APPLIED_VERIFICATION_FAILED';

	constructor(code: PreviewProvenanceRecoveryError['code'], message: string) {
		super(`${code}: ${message}`);
		this.name = 'PreviewProvenanceRecoveryError';
		this.code = code;
	}
}

function parseJson(stdout: string): Record<string, unknown> | null {
	const trimmed = stdout.trim();
	if (!trimmed || trimmed === 'null') return null;
	const start = trimmed.indexOf('{');
	const end = trimmed.lastIndexOf('}');
	if (start < 0 || end < start) throw new Error('Preview receipt query did not return JSON.');
	return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseReceipt(value: unknown): ReceiptRow | null {
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

function parseAsset(value: unknown): PreviewAssetRow | null {
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
function parseState(value: Record<string, unknown>): PreviewReceiptState {
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

function readPackage(path: string): InvitationPackageData {
	return validatePackageData(
		JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as InvitationPackageData,
	);
}

function buildReadOnlyQuery(slug: string): string {
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

function hashValue(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function same(left: unknown, right: unknown): boolean {
	return canonicalize(left) === canonicalize(right);
}

function expectedAssetMetadata(
	asset: InvitationPackageAsset,
	definitionSlug?: string,
): Record<string, unknown> {
	return {
		key: asset.key,
		displayName: asset.displayName,
		storagePath: asset.storagePath,
		bucket: asset.bucket,
		mimeType: asset.mimeType,
		width: asset.width,
		height: asset.height,
		fileSize: asset.fileSize,
		validationVersion: asset.validationVersion,
		originalMimeType: asset.originalMimeType,
		originalFileSize: asset.originalFileSize,
		defaultAltText: asset.defaultAltText,
		provider: asset.provider ?? 'cloudinary',
		providerPublicId: asset.providerPublicId ?? asset.storagePath,
		secureUrl: asset.secureUrl ?? null,
		sha256: asset.sha256,
		managedByDefinitionSlug: definitionSlug ?? null,
		managedSourceKey: asset.key,
		managedSha256: asset.sha256,
	};
}

function currentAssetMetadata(row: PreviewAssetRow): Record<string, unknown> {
	return {
		key: row.managed_source_key,
		displayName: row.display_name,
		storagePath: row.storage_path,
		bucket: row.bucket,
		mimeType: row.mime_type,
		width: row.width,
		height: row.height,
		fileSize: row.file_size,
		validationVersion: row.validation_version,
		originalMimeType: row.original_mime_type,
		originalFileSize: row.original_file_size,
		defaultAltText: row.default_alt_text,
		provider: row.provider,
		providerPublicId: row.provider_public_id,
		secureUrl: row.secure_url,
		sha256: row.sha256,
		managedByDefinitionSlug: row.managed_by_definition_slug,
		managedSourceKey: row.managed_source_key,
		managedSha256: row.managed_sha256,
	};
}

function compareAssets(
	pkg: InvitationPackageData,
	rows: PreviewAssetRow[],
): { equal: boolean; expectedHash: string; currentHash: string } {
	const expected = pkg.assets
		.map((asset) => expectedAssetMetadata(asset, pkg.sourceSlug))
		.sort((a, b) => String(a.key).localeCompare(String(b.key)));
	const byKey = new Map(
		rows
			.filter((row) => row.managed_source_key)
			.map((row) => [row.managed_source_key as string, row]),
	);
	const current = pkg.assets
		.map((asset) =>
			currentAssetMetadata(
				byKey.get(asset.key) ??
					({
						id: '',
						display_name: '',
						storage_path: '',
						bucket: null,
						mime_type: null,
						width: null,
						height: null,
						file_size: null,
						validation_version: null,
						original_mime_type: null,
						original_file_size: null,
						default_alt_text: null,
						provider: null,
						provider_public_id: null,
						provider_version: null,
						secure_url: null,
						sha256: null,
						managed_by_definition_slug: null,
						managed_source_key: null,
						managed_sha256: null,
						managed_operation_id: null,
					} as PreviewAssetRow),
			),
		)
		.sort((a, b) => String(a.key).localeCompare(String(b.key)));
	return {
		equal:
			same(expected, current) &&
			rows.filter((row) => row.managed_source_key).length === pkg.assets.length,
		expectedHash: hashValue(expected),
		currentHash: hashValue(current),
	};
}

function isManagedReceipt(receipt: ReceiptRow | null): boolean {
	if (!receipt) return false;
	if (receipt.commandKind === 'managed_baseline_adoption') return receipt.origin === 'recovery';
	return (
		(receipt.commandKind === 'managed_invitation_apply' ||
			receipt.commandKind === 'managed_baseline_reconstruction') &&
		(receipt.origin === 'managed_cli_local' || receipt.origin === 'managed_cli_hosted')
	);
}

function hasFinalStatus(receipt: ReceiptRow | null): boolean {
	return receipt?.status === 'applied' || receipt?.status === 'replayed';
}

// eslint-disable-next-line complexity -- Recovery classification evaluates independent fail-closed evidence gates.
function buildDiagnosis(
	pkg: InvitationPackageData,
	state: PreviewReceiptState,
): PreviewReceiptDiagnosis {
	const provenance = state.provenance;
	const linked = state.appliedReceipt;
	const latest = state.latestReceipt;
	const refs: Record<string, UploadedAssetRef> = Object.fromEntries(
		state.assets
			.filter((asset) => asset.managed_source_key)
			.map((asset) => [
				asset.managed_source_key,
				{ type: 'uploaded', assetId: asset.id, src: asset.secure_url ?? '' },
			]),
	);
	const expectedDraft = materializeAssetReferences(pkg.draft.content, refs) as Record<
		string,
		unknown
	>;
	const expectedPublication = materializeAssetReferences(
		pkg.publishedContent.content,
		refs,
	) as Record<string, unknown>;
	const expectedPublicationHash = state.published
		? hashPublicationProjection(expectedPublication)
		: null;
	const currentPublicationHash = state.published
		? hashPublicationProjection(state.published.content)
		: null;
	const expectedDraftHash = hashPublicationProjection(expectedDraft);
	const currentDraftHash = state.draft ? hashPublicationProjection(state.draft.content) : null;
	const assets = compareAssets(pkg, state.assets);
	const assetIdentities = Object.fromEntries(
		state.assets
			.filter((asset) => asset.managed_source_key)
			.map((asset) => [
				asset.managed_source_key,
				{ id: asset.id, secureUrl: asset.secure_url },
			]),
	);
	const content = {
		draft: Boolean(state.draft && same(expectedDraft, state.draft.content)),
		publication: Boolean(state.published && same(expectedPublication, state.published.content)),
		managedProjection: Boolean(
			provenance?.managed_projection && same(expectedDraft, provenance.managed_projection),
		),
	};
	const operationIsNew = Boolean(
		latest?.operationId && latest.operationId !== provenance?.applied_operation_id,
	);
	const stale = operationIsNew && isManagedReceipt(latest);
	const provenanceHashes = {
		source: provenance?.source_hash === pkg.sourceHash,
		package: provenance?.package_hash === pkg.packageHash,
		metadata: provenance?.metadata_hash === pkg.metadataHash,
		projection: provenance?.projection_hash === hashValue(pkg.projectionHash),
		assetManifest: provenance?.asset_manifest_hash === pkg.assetManifestHash,
	};
	const latestHashes = {
		source: latest?.inputHashes?.sourceHash === pkg.sourceHash,
		package: latest?.inputHashes?.packageHash === pkg.packageHash,
	};
	const packageHashes = {
		source: latestHashes.source || provenanceHashes.source,
		package: latestHashes.package || provenanceHashes.package,
		metadata: provenanceHashes.metadata,
		projection:
			provenanceHashes.projection ||
			(latestHashes.package && content.draft && content.publication),
		assetManifest: assets.equal,
	};
	const baseline = diagnoseManagedBaseline(
		{
			managedProjection: provenance?.managed_projection,
			hasManagedProjection: Boolean(provenance?.managed_projection),
			releaseSchemaVersion: provenance?.release_schema_version,
			appliedDraftUpdatedAt: provenance?.applied_draft_updated_at,
			appliedOperationId: provenance?.applied_operation_id,
			appliedPublishedVersion: provenance?.applied_published_version,
			appliedPublishedProjectionHash: provenance?.applied_published_projection_hash,
			currentDraftUpdatedAt: state.draft?.updated_at,
			currentPublishedVersion: state.published?.version,
			currentPublishedProjectionHash: currentPublicationHash,
			appliedReceipt: linked,
			latestMutationReceipt: latest,
		},
		RELEASE_SCHEMA_VERSION,
	);
	const classification: ManagedBaselineDiagnosticClassification = stale
		? 'stale_provenance'
		: baseline.classification;
	const blockers: string[] = [];
	if (!provenance) blockers.push('missing_provenance');
	if (provenance?.applied_operation_id) {
		if (!linked) blockers.push('provenance_receipt_missing');
		else {
			if (!hasFinalStatus(linked)) blockers.push('linked_receipt_not_final');
			if (!isManagedReceipt(linked)) blockers.push('linked_receipt_not_managed');
			if (!linked.completedSteps?.includes('target_verified'))
				blockers.push('linked_receipt_missing_target_verified');
			if (!linked.completedSteps?.includes('provenance_recorded'))
				blockers.push('provenance_receipt_step_mismatch');
		}
	}
	if (!latest) blockers.push('missing_latest_receipt');
	if (!hasFinalStatus(latest)) blockers.push('latest_receipt_not_final');
	if (!isManagedReceipt(latest)) blockers.push('latest_receipt_not_managed');
	if (!latest?.completedSteps?.includes('target_verified'))
		blockers.push('latest_receipt_missing_target_verified');
	if (latest?.status === 'partial') blockers.push('partial_previous_operation');
	if (
		latest?.completedSteps?.includes('provenance_recorded') &&
		latest.operationId !== provenance?.applied_operation_id
	)
		blockers.push('receipt_provenance_contradiction');
	if (latest?.inputHashes?.sourceHash !== pkg.sourceHash) blockers.push('source_hash_mismatch');
	if (latest?.inputHashes?.packageHash !== pkg.packageHash)
		blockers.push('package_hash_mismatch');
	for (const [field, expected] of [
		['sourceHash', pkg.sourceHash],
		['packageHash', pkg.packageHash],
		['metadataHash', pkg.metadataHash],
		['projectionHash', pkg.projectionHash],
		['assetManifestHash', pkg.assetManifestHash],
	] as const) {
		if (latest?.inputHashes?.[field] !== undefined && latest.inputHashes[field] !== expected)
			blockers.push(`latest_${field}_mismatch`);
	}
	if (!content.draft) blockers.push('draft_content_mismatch');
	if (!content.publication) blockers.push('publication_content_mismatch');
	if (!content.managedProjection && !stale) blockers.push('managed_projection_mismatch');
	if (!assets.equal) blockers.push('asset_metadata_mismatch');
	if (!packageHashes.source || !packageHashes.package) blockers.push('release_hash_mismatch');
	if (!packageHashes.metadata) blockers.push('metadata_hash_mismatch');
	if (!packageHashes.projection) blockers.push('publication_projection_hash_mismatch');
	if (!packageHashes.assetManifest) blockers.push('asset_manifest_hash_mismatch');
	if (!stale && Object.values(provenanceHashes).some((matches) => !matches))
		blockers.push('provenance_hash_mismatch');
	if (provenance?.definition_slug !== pkg.sourceSlug) blockers.push('definition_slug_mismatch');
	if (provenance?.release_schema_version !== pkg.schemaVersion)
		blockers.push('incompatible_normalization_version');
	if (
		typeof latest?.result?.publishedVersion === 'number' &&
		latest.result.publishedVersion !== state.published?.version
	)
		blockers.push('latest_publication_version_mismatch');
	if (!stale && provenance?.applied_draft_updated_at !== state.draft?.updated_at)
		blockers.push('draft_revision_mismatch');
	if (
		!stale &&
		(provenance?.applied_published_version !== state.published?.version ||
			provenance?.applied_published_projection_hash !== currentPublicationHash)
	)
		blockers.push('publication_revision_mismatch');
	if (
		state.invitation.managed_identity_id &&
		provenance?.managed_identity_id &&
		state.invitation.managed_identity_id !== provenance.managed_identity_id
	)
		blockers.push('identity_conflict');
	if (
		pkg.invitation.managedIdentityId !== state.invitation.managed_identity_id ||
		pkg.invitation.managedIdentityId !== provenance?.managed_identity_id
	)
		blockers.push('package_identity_mismatch');
	const recoveryEligible =
		classification === 'stale_provenance' && stale && blockers.length === 0;
	const status = recoveryEligible
		? 'RECOVERABLE'
		: classification === 'verified_current' &&
			  content.draft &&
			  content.publication &&
			  content.managedProjection &&
			  assets.equal &&
			  Object.values(packageHashes).every(Boolean)
			? 'IN_SYNC'
			: 'BLOCKED';
	return {
		status,
		classification,
		recoveryEligible,
		reasonCode: recoveryEligible
			? 'STALE_PROVENANCE_RECOVERABLE'
			: status === 'IN_SYNC'
				? 'PROVENANCE_CURRENT'
				: 'STALE_PROVENANCE_BLOCKED',
		invitationId: state.invitation.id,
		linkedOperationId: provenance?.applied_operation_id ?? null,
		latestOperationId: latest?.operationId ?? null,
		receipts: { linked, latest },
		completedSteps: {
			linked: linked?.completedSteps ?? [],
			latest: latest?.completedSteps ?? [],
		},
		parity: {
			content,
			assets: assets.equal,
			assetIdentities,
			revisions: {
				draftCurrent: state.draft?.updated_at ?? null,
				draftBaseline: provenance?.applied_draft_updated_at ?? null,
				publicationCurrent: state.published?.version ?? null,
				publicationBaseline: provenance?.applied_published_version ?? null,
			},
			packageHashes,
			comparableHashes: {
				expectedPublication: expectedPublicationHash,
				currentPublication: currentPublicationHash,
				expectedDraft: expectedDraftHash,
				currentDraft: currentDraftHash,
				expectedAssetMetadata: assets.expectedHash,
				currentAssetMetadata: assets.currentHash,
			},
		},
		writes: { content: 0, storage: 0, metadata: recoveryEligible ? 2 : 0 },
		blockers,
		message: recoveryEligible
			? 'La operación administrada más reciente coincide con el paquete y solo falta reconciliar la provenance.'
			: status === 'IN_SYNC'
				? 'La provenance y el estado publicado ya están sincronizados.'
				: 'La evidencia de Preview no permite una recuperación metadata-only segura.',
		nextAction: recoveryEligible
			? 'Revise este plan y ejecute --reconcile-stale --apply con autorización Owner.'
			: status === 'IN_SYNC'
				? 'No se requiere intervención.'
				: 'Corrija la evidencia bloqueante; no existe comando de Apply seguro.',
	};
}

/** Pure evaluator seam used by focused tests and dashboard/status consumers. */
export function evaluatePreviewReceiptState(
	pkg: InvitationPackageData,
	state: PreviewReceiptState,
): PreviewReceiptDiagnosis {
	return buildDiagnosis(pkg, state);
}

export async function inspectPreviewProvenanceReceipt(input: {
	packagePath: string;
}): Promise<PreviewReceiptDiagnosis> {
	const pkg = readPackage(input.packagePath);
	const resolved = getPreviewDbUrl();
	const dbUrl = assertPreviewDbUrl(resolved.url).toString();
	const row = parseJson(
		runPsql(buildReadOnlyQuery(pkg.invitation.slug), dbUrl, { tuplesOnly: true }).stdout,
	);
	if (!row) throw new Error('Preview receipt inspection returned no invitation.');
	return buildDiagnosis(pkg, parseState(row));
}

function sqlTextArray(values: readonly string[]): string {
	return values.length === 0 ? 'array[]::text[]' : `array[${values.map(sqlLiteral).join(', ')}]`;
}

function buildAssetChecks(pkg: InvitationPackageData, invitationId: string): string {
	return pkg.assets
		.map((asset) => {
			const expected = expectedAssetMetadata(asset, pkg.sourceSlug);
			const nullable = (value: unknown): string =>
				value === null ? 'null' : sqlLiteral(String(value));
			return `exists (select 1 from public.invitation_assets ia where ia.invitation_id = ${sqlLiteral(invitationId)}::uuid and ia.deleted_at is null and ia.managed_source_key = ${sqlLiteral(asset.key)} and ia.managed_by_definition_slug = ${sqlLiteral(pkg.sourceSlug)} and ia.provider is not distinct from ${nullable(expected.provider)} and ia.provider_public_id is not distinct from ${nullable(expected.providerPublicId)} and ia.secure_url is not distinct from ${nullable(expected.secureUrl)} and ia.sha256 is not distinct from ${nullable(expected.sha256)} and ia.managed_sha256 is not distinct from ${nullable(expected.managedSha256)} and ia.display_name is not distinct from ${nullable(expected.displayName)} and ia.storage_path is not distinct from ${nullable(expected.storagePath)} and ia.bucket is not distinct from ${nullable(expected.bucket)} and ia.mime_type is not distinct from ${nullable(expected.mimeType)} and ia.width is not distinct from ${expected.width === null ? 'null' : String(expected.width)} and ia.height is not distinct from ${expected.height === null ? 'null' : String(expected.height)} and ia.file_size is not distinct from ${expected.fileSize === null ? 'null' : String(expected.fileSize)} and ia.validation_version is not distinct from ${expected.validationVersion === null ? 'null' : String(expected.validationVersion)} and ia.original_mime_type is not distinct from ${nullable(expected.originalMimeType)} and ia.original_file_size is not distinct from ${expected.originalFileSize === null ? 'null' : String(expected.originalFileSize)} and ia.default_alt_text is not distinct from ${nullable(expected.defaultAltText)})`;
		})
		.join(' and ');
}

// eslint-disable-next-line complexity -- Transaction builder keeps every recovery precondition in one SQL boundary.
function applyRecovery(
	pkg: InvitationPackageData,
	diagnosis: PreviewReceiptDiagnosis,
	dbUrl: string,
): void {
	if (!diagnosis.recoveryEligible || !diagnosis.invitationId || !diagnosis.latestOperationId)
		throw new PreviewProvenanceRecoveryError(
			'PREVIEW_RECONCILE_BLOCKED',
			'La evidencia cambió o no es elegible para recuperación.',
		);
	const operationId = randomUUID();
	const assetRefs = Object.fromEntries(
		Object.entries(diagnosis.parity.assetIdentities).map(([key, value]) => [
			key,
			{ type: 'uploaded' as const, assetId: value.id, src: value.secureUrl ?? '' },
		]),
	);
	const expectedDraft = materializeAssetReferences(pkg.draft.content, assetRefs) as Record<
		string,
		unknown
	>;
	const expectedPublication = materializeAssetReferences(
		pkg.publishedContent.content,
		assetRefs,
	) as Record<string, unknown>;
	const expectedState = {
		draftUpdatedAt: diagnosis.parity.revisions.draftCurrent,
		publishedVersion: diagnosis.parity.revisions.publicationCurrent,
		latestOperationId: diagnosis.latestOperationId,
	};
	const sql = `
begin;
select id from public.invitations where id = ${sqlLiteral(diagnosis.invitationId)}::uuid and slug = ${sqlLiteral(pkg.invitation.slug)} and archived_at is null and kind = 'client' for update;
select invitation_id from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid for update;
select operation_id from public.invitation_mutation_operation_receipts where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid order by created_at desc, id desc limit 1 for update;
do $$ begin
  if not exists (select 1 from public.invitation_mutation_operation_receipts where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and operation_id = ${sqlLiteral(diagnosis.latestOperationId)}::uuid and status in ('applied', 'replayed') and command_kind in ('managed_invitation_apply', 'managed_baseline_reconstruction') and origin in ('managed_cli_local', 'managed_cli_hosted') and 'target_verified' = any(completed_steps) and input_hashes->>'sourceHash' = ${sqlLiteral(pkg.sourceHash)} and input_hashes->>'packageHash' = ${sqlLiteral(pkg.packageHash)}) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: latest receipt changed'; end if;
  if not exists (select 1 from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and applied_operation_id = ${sqlLiteral(diagnosis.linkedOperationId ?? '')}::uuid and definition_slug = ${sqlLiteral(pkg.sourceSlug)} and managed_identity_id = ${sqlLiteral(pkg.invitation.managedIdentityId)}::uuid and release_schema_version = ${sqlLiteral(pkg.schemaVersion)}) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: provenance changed'; end if;
  if exists (select 1 from public.invitation_mutation_operation_receipts where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and operation_id = ${sqlLiteral(diagnosis.latestOperationId)}::uuid and 'provenance_recorded' = any(completed_steps) and operation_id <> ${sqlLiteral(diagnosis.linkedOperationId ?? '')}::uuid) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: receipt/provenance contradiction'; end if;
  if not exists (select 1 from public.invitation_content_drafts where invitation_project_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and deleted_at is null and updated_at::text = ${sqlLiteral(String(diagnosis.parity.revisions.draftCurrent ?? ''))} and content = ${sqlLiteral(JSON.stringify(expectedDraft))}::jsonb) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: draft changed'; end if;
  if not exists (select 1 from public.published_invitation_content where invitation_project_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and deleted_at is null and version = ${Number(diagnosis.parity.revisions.publicationCurrent ?? 0)} and content = ${sqlLiteral(JSON.stringify(expectedPublication))}::jsonb) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: publication changed'; end if;
  if not (${buildAssetChecks(pkg, diagnosis.invitationId) || 'false'}) then raise exception 'PREVIEW_RECONCILE_PRECONDITION_FAILED: asset metadata changed'; end if;
end $$;
update public.managed_invitation_release_provenance set definition_slug = ${sqlLiteral(pkg.sourceSlug)}, managed_identity_id = ${sqlLiteral(pkg.invitation.managedIdentityId)}::uuid, previous_slugs = ${sqlTextArray(pkg.invitation.previousSlugs)}, release_schema_version = ${sqlLiteral(pkg.schemaVersion)}, source_hash = ${sqlLiteral(pkg.sourceHash)}, package_hash = ${sqlLiteral(pkg.packageHash)}, metadata_hash = ${sqlLiteral(pkg.metadataHash)}, projection_hash = ${sqlLiteral(hashValue(pkg.projectionHash))}, asset_manifest_hash = ${sqlLiteral(pkg.assetManifestHash)}, managed_projection = ${sqlLiteral(JSON.stringify(expectedDraft))}::jsonb, applied_draft_updated_at = ${sqlLiteral(String(diagnosis.parity.revisions.draftCurrent ?? ''))}::timestamptz, applied_operation_id = ${sqlLiteral(operationId)}::uuid, applied_published_version = ${Number(diagnosis.parity.revisions.publicationCurrent ?? 0)}, applied_published_projection_hash = ${sqlLiteral(String(diagnosis.parity.comparableHashes.currentPublication ?? ''))}, applied_at = now() where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid and applied_operation_id = ${sqlLiteral(diagnosis.linkedOperationId ?? '')}::uuid;
insert into public.invitation_mutation_operation_receipts (operation_id, invitation_id, environment, project_ref, actor_type, origin, command_kind, input_hashes, expected_state, status, completed_steps, result, retry_of_operation_id) values (${sqlLiteral(operationId)}::uuid, ${sqlLiteral(diagnosis.invitationId)}::uuid, 'preview', 'preview', 'recovery', 'recovery', 'managed_baseline_adoption', ${sqlLiteral(JSON.stringify({ sourceHash: pkg.sourceHash, packageHash: pkg.packageHash, adoptedFromOperationId: diagnosis.latestOperationId }))}::jsonb, ${sqlLiteral(JSON.stringify(expectedState))}::jsonb, 'applied', ${sqlTextArray(['target_verified', 'provenance_recorded'])}, ${sqlLiteral(JSON.stringify({ metadataOnly: true, contentWrites: 0, storageWrites: 0 }))}::jsonb, ${sqlLiteral(diagnosis.latestOperationId)}::uuid);
commit;`;
	runPsql(sql, dbUrl);
	const readBack = parseJson(
		runPsql(
			`select json_build_object('provenance', (select row_to_json(p) from (select applied_operation_id::text, package_hash from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(diagnosis.invitationId)}::uuid) p), 'receipt', (select row_to_json(r) from (select operation_id::text, status, command_kind, completed_steps from public.invitation_mutation_operation_receipts where operation_id = ${sqlLiteral(operationId)}::uuid) r));`,
			dbUrl,
			{ tuplesOnly: true },
		).stdout,
	);
	const provenance = record(readBack?.provenance);
	const receipt = record(readBack?.receipt);
	if (
		provenance?.applied_operation_id !== operationId ||
		provenance.package_hash !== pkg.packageHash ||
		receipt?.operation_id !== operationId ||
		receipt.status !== 'applied' ||
		receipt.command_kind !== 'managed_baseline_adoption'
	)
		throw new PreviewProvenanceRecoveryError(
			'APPLIED_VERIFICATION_FAILED',
			'La reconciliación pudo aplicarse, pero el read-back no coincide. No reintente automáticamente.',
		);
}

export async function reconcileStalePreviewProvenance(input: {
	packagePath: string;
	apply?: boolean;
}): Promise<PreviewReceiptDiagnosis & { applied?: boolean }> {
	const diagnosis = await inspectPreviewProvenanceReceipt(input);
	if (!input.apply) return diagnosis;
	if (!diagnosis.recoveryEligible)
		throw new PreviewProvenanceRecoveryError('PREVIEW_RECONCILE_BLOCKED', diagnosis.message);
	const dbUrl = assertPreviewDbUrl(getPreviewDbUrl().url).toString();
	applyRecovery(readPackage(input.packagePath), diagnosis, dbUrl);
	let verified: PreviewReceiptDiagnosis;
	try {
		verified = await inspectPreviewProvenanceReceipt(input);
	} catch {
		throw new PreviewProvenanceRecoveryError(
			'APPLIED_VERIFICATION_FAILED',
			'La reconciliación pudo aplicarse, pero la verificación post-Apply no pudo completarse. No reintente automáticamente.',
		);
	}
	if (verified.status !== 'IN_SYNC' || verified.blockers.length > 0)
		throw new PreviewProvenanceRecoveryError(
			'APPLIED_VERIFICATION_FAILED',
			'La reconciliación pudo aplicarse, pero el estado post-Apply no quedó sincronizado. No reintente automáticamente.',
		);
	return {
		...verified,
		applied: true,
		writes: { content: 0, storage: 0, metadata: 2 },
	};
}
