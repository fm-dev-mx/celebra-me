/**
 * invitation-import-engine.ts — Shared Import Engine for Preview & Production
 */
/* eslint-disable max-lines -- Target identity, planning, apply, and verification share one atomic safety boundary. */

import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import type { InvitationPackageData, InvitationPackageAsset } from './invitation-package.ts';
import { computePackageHash, PACKAGE_SCHEMA_VERSION } from './invitation-package.ts';
import {
	classifyDbTarget,
	redactCredentials,
	validateEnvironmentUrlsPreflight,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	type DbTarget,
} from '../db/db-target-config.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	resolvePreviewAdminUser,
	updatePreviewAdminRole,
	ensureHostProfile,
} from '../db/preview-sync-guards.ts';
import {
	hashPublicMetadata,
	hashPublicationProjection,
} from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	checkInvitationMetadataIdentical,
	checkDraftContentIdentical,
	checkPublishedContentIdentical,
	checkEventAndMembershipIdentical,
	rewritePackageStorageUrls,
	checkTargetDivergenceConflict,
	buildResourceActions,
} from './promotion-comparison.ts';
import { materializeAssetReferences } from './normalized-invitation-release.ts';
import type { UploadedAssetMap } from './invitations/invitation-definition.ts';
import { cleanupHostedPsqlResources, type TrackedResource } from './managed-invitation-cleanup.ts';
import {
	buildSemanticFunctionalChanges,
	computePlanId,
	verifyPlanPreconditions,
	type FunctionalChange,
	type OperationalPlan,
} from './invitation-update-plan.ts';
import {
	reconcileAssets,
	type AssetPolicy,
	type TargetAssetRecord,
	type ObservedStorageState,
	type AssetReconciliationResult,
} from './asset-reconciliation.ts';

export interface ImportEngineOptions {
	packagePath?: string;
	packageData?: InvitationPackageData;
	target: 'preview' | 'production';
	ownerUserId?: string;
	dryRun?: boolean;
	targetDbUrl: string;
	targetSupabaseUrl?: string;
	serviceRoleKey?: string;
	plan?: OperationalPlan;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
}

export interface ResourcePlanAction {
	resource: string;
	name: string;
	action: 'create' | 'replace' | 'reuse' | 'skip' | 'delete';
	detail: string;
}

export interface ImportEngineResult {
	packageHash: string;
	slug: string;
	target: DbTarget;
	projectRef: string;
	ownerUserId: string;
	publishedVersion: number;
	projectionHash: string;
	route: string;
	actions: ResourcePlanAction[];
	plannedMutations: number;
	executedMutations: number;
	isZeroDrift: boolean;
	mutationsPerformed: number;
	verifiedAssetHashes: Record<string, string>;
	isZeroDriftRerun: boolean;
	functionalChanges?: FunctionalChange[];
	plan?: OperationalPlan;
	receipt?: {
		planId: string;
		executedAt: string;
		status: 'EXECUTED' | 'IN_SYNC';
		completedOperations: number;
		publishedVersion?: number;
	};
}

function sha256Bytes(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function parsePsqlJson(stdout: string): Record<string, unknown> {
	const trimmed = stdout.trim();
	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
	}
	return JSON.parse(trimmed) as Record<string, unknown>;
}

function parsePsqlJsonArray(stdout: string): Array<Record<string, unknown>> {
	const trimmed = stdout.trim();
	if (!trimmed || trimmed === 'null') return [];
	const firstBracket = trimmed.indexOf('[');
	const lastBracket = trimmed.lastIndexOf(']');
	if (firstBracket !== -1 && lastBracket > firstBracket) {
		return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as Array<
			Record<string, unknown>
		>;
	}
	return JSON.parse(trimmed) as Array<Record<string, unknown>>;
}

export function validatePackageData(pkg: InvitationPackageData): InvitationPackageData {
	if (!pkg || typeof pkg !== 'object') throw new Error('Package data is required.');
	if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
		throw new Error(
			`Package schema version mismatch: expected "${PACKAGE_SCHEMA_VERSION}", got "${pkg.schemaVersion}".`,
		);
	}
	for (const [name, value] of Object.entries({
		sourceHash: pkg.sourceHash,
		metadataHash: pkg.metadataHash,
		assetManifestHash: pkg.assetManifestHash,
		packageHash: pkg.packageHash,
	})) {
		if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
			throw new Error(`Package is missing a valid SHA-256 ${name}.`);
		}
	}
	if (typeof pkg.projectionHash !== 'string' || !/^[a-f0-9]{32}$/.test(pkg.projectionHash)) {
		throw new Error('Package is missing a valid MD5 projectionHash.');
	}
	if (!pkg.definitionCreatedAt || !pkg.sourceSlug || !pkg.publishedContent || !pkg.event) {
		throw new Error(
			'Package is missing required release metadata, published content, or event data.',
		);
	}
	const computedHash = computePackageHash(pkg);
	if (computedHash !== pkg.packageHash) {
		throw new Error(
			`Package hash integrity verification failed! Computed ${computedHash}, package claims ${pkg.packageHash}.`,
		);
	}
	return pkg;
}

function validatePackage(packagePath: string): InvitationPackageData {
	if (!existsSync(packagePath))
		throw new Error(`Package file does not exist at path: "${packagePath}"`);
	let pkg: InvitationPackageData;
	try {
		pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as InvitationPackageData;
	} catch (err) {
		throw new Error(`Package file at "${packagePath}" is not valid JSON.`, { cause: err });
	}

	return validatePackageData(pkg);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TargetInvitationIdentity {
	existingInvitation: Record<string, unknown> | null;
	ownerUserId: string;
	isNewInvitation: boolean;
}

/** Resolves ownership from the selected target before any plan or write is constructed. */
export function resolveTargetInvitationIdentity(input: {
	target: 'preview' | 'production';
	slug: string;
	explicitOwnerId?: string;
	activeInvitations: Array<Record<string, unknown>>;
	archivedInvitations: Array<Record<string, unknown>>;
	previewOwnerUserId?: string;
	ownerExists: (ownerUserId: string) => boolean;
}): TargetInvitationIdentity {
	if (input.activeInvitations.length > 1)
		throw new Error(`Target contains multiple active invitations for slug "${input.slug}".`);
	if (input.activeInvitations.length === 0 && input.archivedInvitations.length > 0)
		throw new Error(`Target invitation "${input.slug}" is archived and cannot be updated.`);
	const existingInvitation = input.activeInvitations[0] ?? null;
	const ownerUserId = existingInvitation
		? String(existingInvitation.created_by ?? '')
		: input.target === 'preview'
			? (input.previewOwnerUserId ?? '')
			: (input.explicitOwnerId ?? '');
	if (existingInvitation && existingInvitation.kind !== 'client')
		throw new Error(`Target invitation "${input.slug}" is not a client invitation.`);
	if (!ownerUserId || !UUID_PATTERN.test(ownerUserId))
		throw new Error(
			existingInvitation
				? `Target invitation "${input.slug}" has a missing or invalid owner.`
				: 'Creating a new Production invitation requires an explicit --owner-user-id <UUID>.',
		);
	if (existingInvitation && input.explicitOwnerId && input.explicitOwnerId !== ownerUserId)
		throw new Error(
			`--owner-user-id does not match the existing target owner for "${input.slug}".`,
		);
	if (!input.ownerExists(ownerUserId))
		throw new Error(
			`Target owner UUID "${ownerUserId}" does not exist in target auth.users table.`,
		);
	return { existingInvitation, ownerUserId, isNewInvitation: !existingInvitation };
}

function resolveTargetIdentity(
	expectedTarget: 'preview' | 'production',
	slug: string,
	explicitOwnerId: string | undefined,
	targetDbUrl: string,
): TargetInvitationIdentity {
	const rows = parsePsqlJsonArray(
		runPsql(
			`select json_agg(t) from (select id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by, archived_at from public.invitations where slug = ${sqlLiteral(slug)} order by archived_at nulls first, id) t;`,
			targetDbUrl,
			{ tuplesOnly: true, throwOnError: false },
		).stdout,
	);
	return resolveTargetInvitationIdentity({
		target: expectedTarget,
		slug,
		explicitOwnerId,
		activeInvitations: rows.filter((row) => row.archived_at === null),
		archivedInvitations: rows.filter((row) => row.archived_at !== null),
		previewOwnerUserId:
			expectedTarget === 'preview' ? resolvePreviewAdminUser(targetDbUrl) : undefined,
		ownerExists: (ownerUserId) =>
			Boolean(
				runPsql(
					`select id from auth.users where id = ${sqlLiteral(ownerUserId)};`,
					targetDbUrl,
					{ tuplesOnly: true, throwOnError: false },
				).stdout.trim(),
			),
	});
}

function fetchTargetDbAssets(
	targetDbUrl?: string,
	targetInvitationId?: string,
): TargetAssetRecord[] {
	const targetDbAssets: TargetAssetRecord[] = [];
	if (!targetDbUrl || !targetInvitationId) return targetDbAssets;

	const assetsQuery = `select id::text, display_name, storage_path, bucket, mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size, default_alt_text from public.invitation_assets where invitation_id = '${targetInvitationId}'::uuid and deleted_at is null`;
	const assetsResult = runPsql(`select json_agg(t) from (${assetsQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	for (const row of parsePsqlJsonArray(assetsResult.stdout)) {
		if (typeof row.storage_path === 'string') {
			targetDbAssets.push({
				id: row.id as string,
				displayName: row.display_name as string,
				storagePath: row.storage_path as string,
				bucket: (row.bucket as string) ?? 'invitation-assets',
				mimeType: (row.mime_type as string) ?? 'image/webp',
				fileSize: row.file_size !== null ? Number(row.file_size) : null,
				width: row.width !== null ? Number(row.width) : null,
				height: row.height !== null ? Number(row.height) : null,
				validationVersion: Number(row.validation_version ?? 1),
				originalMimeType: (row.original_mime_type as string) ?? null,
				originalFileSize: row.original_file_size !== null ? Number(row.original_file_size) : null,
				altText: (row.default_alt_text as string) ?? null,
			});
		}
	}
	return targetDbAssets;
}

async function probeStorageStates(
	assets: InvitationPackageAsset[],
	targetDbAssets: TargetAssetRecord[],
	targetStorageUrl: string,
): Promise<{
	observedStorage: Record<string, ObservedStorageState>;
	verifiedAssetHashes: Record<string, string>;
}> {
	const observedStorage: Record<string, ObservedStorageState> = {};
	const verifiedAssetHashes: Record<string, string> = {};
	const pathsToProbe = Array.from(
		new Set([
			...assets.map((a) => a.storagePath),
			...targetDbAssets.map((t) => t.storagePath),
		]),
	);

	const BATCH_SIZE = 5;
	for (let i = 0; i < pathsToProbe.length; i += BATCH_SIZE) {
		const batch = pathsToProbe.slice(i, i + BATCH_SIZE);
		await Promise.all(
			batch.map(async (storagePath) => {
				const targetAssetUrl = `${targetStorageUrl}/${storagePath}`;
				try {
					const fetchRes = await fetch(targetAssetUrl);
					if (fetchRes.ok) {
						const ab = await fetchRes.arrayBuffer();
						const hash = sha256Bytes(new Uint8Array(ab));
						observedStorage[storagePath] = { present: true, sha256: hash, httpStatus: fetchRes.status };
						verifiedAssetHashes[storagePath] = hash;
					} else {
						observedStorage[storagePath] = { present: false, sha256: null, httpStatus: fetchRes.status };
					}
				} catch {
					observedStorage[storagePath] = { present: false, sha256: null };
				}
			}),
		);
	}
	return { observedStorage, verifiedAssetHashes };
}

async function scanAssetStatus(
	assets: InvitationPackageAsset[],
	targetStorageUrl: string,
	targetDbUrl?: string,
	targetInvitationId?: string,
	policy: AssetPolicy = 'missing',
	pruneAssets = false,
): Promise<{
	assetsToUpload: InvitationPackageAsset[];
	assetsToUpsertDbOnly: InvitationPackageAsset[];
	assetsToDelete: TargetAssetRecord[];
	assetActions: ResourcePlanAction[];
	verifiedAssetHashes: Record<string, string>;
	assetStateHash: string;
	reconciliation: AssetReconciliationResult;
}> {
	const targetDbAssets = fetchTargetDbAssets(targetDbUrl, targetInvitationId);
	const { observedStorage, verifiedAssetHashes } = await probeStorageStates(
		assets,
		targetDbAssets,
		targetStorageUrl,
	);

	const reconciliation = reconcileAssets({
		canonicalAssets: assets,
		targetDbAssets,
		observedStorage,
		policy,
		pruneAssets,
	});

	if (reconciliation.blocked) {
		throw new Error(
			reconciliation.blockReason ??
				'La reconciliación de archivos fue bloqueada debido a inconsistencias o conflictos de estado.',
		);
	}

	const assetsToUpload: InvitationPackageAsset[] = [];
	const assetsToUpsertDbOnly: InvitationPackageAsset[] = [];
	const assetsToDelete: TargetAssetRecord[] = [];
	const assetActions: ResourcePlanAction[] = [];

	const canonicalMap = new Map(assets.map((a) => [a.key, a]));

	for (const item of reconciliation.reconciledAssets) {
		const pAsset = canonicalMap.get(item.key);
		if (!pAsset) continue;

		if (item.plannedAction === 'REUSE') {
			assetActions.push({
				resource: 'invitation_assets',
				name: item.displayName,
				action: 'reuse',
				detail: `Storage binary and metadata up-to-date (SHA-256: ${item.canonicalHash.slice(0, 12)}…)`,
			});
		} else if (item.plannedAction === 'REPAIR_METADATA') {
			assetsToUpsertDbOnly.push(pAsset);
			assetActions.push({
				resource: 'invitation_assets',
				name: item.displayName,
				action: 'replace',
				detail: `Update asset DB metadata (Storage binary up-to-date)`,
			});
		} else if (item.plannedAction === 'UPLOAD' || item.plannedAction === 'OVERWRITE') {
			assetsToUpload.push(pAsset);
			assetActions.push({
				resource: 'invitation_assets',
				name: item.displayName,
				action: item.plannedAction === 'UPLOAD' ? 'create' : 'replace',
				detail: `${item.plannedAction === 'UPLOAD' ? 'Upload binary to' : 'Overwrite binary in'} Storage (${(pAsset.fileSize ?? 0) / 1024} KB WebP)`,
			});
		}
	}

	for (const item of reconciliation.unreferencedAssets) {
		if (item.plannedAction === 'PRUNE') {
			const targetRecord = targetDbAssets.find((r) => r.storagePath === item.targetStoragePath);
			if (targetRecord) assetsToDelete.push(targetRecord);
			assetActions.push({
				resource: 'invitation_assets',
				name: item.displayName,
				action: 'delete',
				detail: `Delete unreferenced asset with --prune-assets`,
			});
		}
	}

	const assetStateHash = createHash('sha256')
		.update(
			JSON.stringify({
				rows: targetDbAssets.sort((a, b) => a.storagePath.localeCompare(b.storagePath)),
				observedStorage,
			}),
		)
		.digest('hex');

	return {
		assetsToUpload,
		assetsToUpsertDbOnly,
		assetsToDelete,
		assetActions,
		verifiedAssetHashes,
		assetStateHash,
		reconciliation,
	};
}

async function uploadAndVerifyAssets(
	assetsToUpload: InvitationPackageAsset[],
	targetSupabaseUrl: string,
	targetStorageUrl: string,
	serviceRoleKey?: string,
): Promise<{ verifiedAssetHashes: Record<string, string>; uploadedCount: number }> {
	const verifiedAssetHashes: Record<string, string> = {};
	let uploadedCount = 0;

	for (const pAsset of assetsToUpload) {
		const uploadUrl = `${targetSupabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${pAsset.bucket}/${pAsset.storagePath}`;
		const bytes = Buffer.from(pAsset.dataBase64, 'base64');
		const ab = new ArrayBuffer(bytes.length);
		new Uint8Array(ab).set(bytes);
		const blob = new Blob([ab], { type: pAsset.mimeType });

		const headers: Record<string, string> = {
			'Content-Type': pAsset.mimeType,
			'x-upsert': 'true',
		};
		if (serviceRoleKey) {
			headers.Authorization = `Bearer ${serviceRoleKey}`;
			headers.apikey = serviceRoleKey;
		}

		const uploadRes = await fetch(uploadUrl, { method: 'POST', headers, body: blob });
		if (!uploadRes.ok) {
			const errBody = await uploadRes.text().catch(() => '');
			throw new Error(
				`Storage upload failed for "${pAsset.storagePath}" (HTTP ${uploadRes.status}): ${errBody.slice(0, 200)}`,
			);
		}

		const targetAssetUrl = `${targetStorageUrl}/${pAsset.storagePath}`;
		const verifyRes = await fetch(targetAssetUrl);
		if (!verifyRes.ok)
			throw new Error(
				`Storage read-back verification failed for "${pAsset.storagePath}" (HTTP ${verifyRes.status}).`,
			);
		const readBackAb = await verifyRes.arrayBuffer();
		const readBackHash = sha256Bytes(new Uint8Array(readBackAb));
		if (readBackHash !== pAsset.sha256) {
			throw new Error(
				`Storage read-back SHA-256 hash mismatch for "${pAsset.storagePath}": expected ${pAsset.sha256}, got ${readBackHash}.`,
			);
		}

		verifiedAssetHashes[pAsset.storagePath] = readBackHash;
		uploadedCount++;
	}

	return { verifiedAssetHashes, uploadedCount };
}

interface DatabaseUpsertParams {
	targetDbUrl: string;
	targetInvitationId: string;
	ownerUserId: string;
	slug: string;
	eventType: string;
	pkg: InvitationPackageData;
	targetSnapshot: Record<string, unknown>;
	targetDraftContent: Record<string, unknown>;
	targetPublishedContent: Record<string, unknown>;
	existingDraft: Record<string, unknown> | null;
	existingPub: Record<string, unknown> | null;
	shouldUpsertInv: boolean;
	assetsForDbUpsert: InvitationPackageAsset[];
	shouldUpsertDraft: boolean;
	shouldPublish: boolean;
	shouldUpsertEvent: boolean;
	assetRefs: UploadedAssetMap;
}

/** Revalidates the draft revision immediately before an apply phase can write. */
export function assertDraftRevisionUnchanged(
	targetDbUrl: string,
	existingDraft: Record<string, unknown> | null,
): void {
	if (!existingDraft?.id || !existingDraft.updated_at) return;
	const revision = runPsql(
		`select updated_at::text from public.invitation_content_drafts where id = '${existingDraft.id}'::uuid and deleted_at is null;`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	).stdout.trim();
	const expected = Date.parse(String(existingDraft.updated_at));
	const actual = Date.parse(revision);
	if (
		!revision ||
		!Number.isFinite(expected) ||
		!Number.isFinite(actual) ||
		expected !== actual
	) {
		throw new Error(
			'Target draft changed after planning; refusing to overwrite a stale revision.',
		);
	}
}

function upsertAssetRows(
	targetDbUrl: string,
	targetInvitationId: string,
	assets: InvitationPackageAsset[],
	assetRefs: UploadedAssetMap,
): number {
	let count = 0;
	for (const pAsset of assets) {
		const assetId = assetRefs[pAsset.key]?.assetId;
		if (!assetId)
			throw new Error(`Missing target asset UUID for semantic key "${pAsset.key}".`);
		const assetSql = `insert into public.invitation_assets (id, invitation_id, display_name, default_alt_text, bucket, storage_path, mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size) values ('${assetId}'::uuid, '${targetInvitationId}'::uuid, ${sqlLiteral(pAsset.displayName)}, ${pAsset.defaultAltText ? sqlLiteral(pAsset.defaultAltText) : 'null'}, ${sqlLiteral(pAsset.bucket)}, ${sqlLiteral(pAsset.storagePath)}, ${sqlLiteral(pAsset.mimeType)}, ${pAsset.width ?? 'null'}, ${pAsset.height ?? 'null'}, ${pAsset.fileSize ?? 'null'}, ${pAsset.validationVersion}, ${pAsset.originalMimeType ? sqlLiteral(pAsset.originalMimeType) : 'null'}, ${pAsset.originalFileSize ?? 'null'}) on conflict (bucket, storage_path) do update set display_name = excluded.display_name, default_alt_text = excluded.default_alt_text, mime_type = excluded.mime_type, width = excluded.width, height = excluded.height, file_size = excluded.file_size, validation_version = excluded.validation_version, original_mime_type = excluded.original_mime_type, original_file_size = excluded.original_file_size, deleted_at = null, updated_at = now();`;
		runPsql(assetSql, targetDbUrl);
		count++;
	}
	return count;
}

function executePublicationRpcCall(
	params: DatabaseUpsertParams,
	finalDraftId: string,
	finalDraftUpdatedAt: string,
): void {
	const { targetDbUrl, targetInvitationId, slug, eventType, targetPublishedContent } = params;
	const liveInvRes = runPsql(
		`select row_to_json(t) from (select id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, archived_at from public.invitations where id = '${targetInvitationId}'::uuid) t;`,
		targetDbUrl,
		{ tuplesOnly: true },
	);
	const liveInv = parsePsqlJson(liveInvRes.stdout);
	const livePubRes = runPsql(
		`select row_to_json(t) from (select version, content from public.published_invitation_content where invitation_project_id = '${targetInvitationId}'::uuid and deleted_at is null order by version desc limit 1) t;`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const livePub = livePubRes.stdout.trim() ? parsePsqlJson(livePubRes.stdout) : null;

	const expectedPublishedVersion = livePub ? (livePub.version as number) : null;
	const publicMetadataHash = hashPublicMetadata(
		{
			slug: liveInv.slug as string,
			title: liveInv.title as string,
			eventType: liveInv.event_type as string,
			baseDemoId: liveInv.base_demo_id as string,
			themeId: liveInv.theme_id as string,
			kind: liveInv.kind as string,
			snapshot: (liveInv.snapshot as Record<string, unknown>) ?? {},
			status: liveInv.status as string,
			archivedAt: (liveInv.archived_at as string) ?? null,
		},
		livePub?.content as Record<string, unknown> | undefined,
	);
	const rpcSql = `select row_to_json(t) from (select publish_invitation_atomic(p_invitation_id => '${targetInvitationId}'::uuid, p_draft_id => '${finalDraftId}'::uuid, p_expected_draft_updated_at => '${finalDraftUpdatedAt}'::timestamptz, p_expected_published_version => ${expectedPublishedVersion ?? 'null'}, p_public_metadata_hash => ${sqlLiteral(publicMetadataHash)}, p_projection_hash => ${sqlLiteral(hashPublicationProjection(targetPublishedContent))}, p_idempotency_key => '${randomUUID()}'::uuid, p_slug => ${sqlLiteral(slug)}, p_event_type => ${sqlLiteral(eventType)}, p_is_demo => false, p_content => ${sqlLiteral(JSON.stringify(targetPublishedContent))}::jsonb)) t;`;
	if (!runPsql(rpcSql, targetDbUrl, { tuplesOnly: true }).stdout.trim()) {
		throw new Error('Publication RPC failed to return a result.');
	}
}

function executeDatabaseUpserts(params: DatabaseUpsertParams): number {
	const {
		targetDbUrl,
		targetInvitationId,
		ownerUserId,
		slug,
		eventType,
		pkg,
		targetSnapshot,
		targetDraftContent,
		existingDraft,
		shouldUpsertInv,
		assetsForDbUpsert,
		shouldUpsertDraft,
		shouldPublish,
		shouldUpsertEvent,
	} = params;
	let count = 0;

	if (shouldUpsertInv) {
		const invUpsertSql = `insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by) values ('${targetInvitationId}'::uuid, ${sqlLiteral(slug)}, ${sqlLiteral(pkg.invitation.title)}, ${sqlLiteral(eventType)}, 'draft', ${sqlLiteral(pkg.invitation.baseDemoId)}, ${sqlLiteral(pkg.invitation.themeId)}, ${sqlLiteral(pkg.invitation.kind)}, ${sqlLiteral(JSON.stringify(targetSnapshot))}::jsonb, ${sqlLiteral(pkg.invitation.clientName)}, ${sqlLiteral(pkg.invitation.clientEmail)}, ${sqlLiteral(pkg.invitation.clientWhatsapp)}, ${pkg.invitation.photosReceived ? 'true' : 'false'}, '${ownerUserId}'::uuid) on conflict (slug) where (archived_at is null) do update set title = excluded.title, base_demo_id = excluded.base_demo_id, theme_id = excluded.theme_id, snapshot = excluded.snapshot, client_name = excluded.client_name, client_email = excluded.client_email, client_whatsapp = excluded.client_whatsapp, photos_received = excluded.photos_received, updated_at = now() returning id;`;
		runPsql(invUpsertSql, targetDbUrl, { tuplesOnly: true });
		count++;
	}

	if (assetsForDbUpsert.length > 0) {
		count += upsertAssetRows(
			targetDbUrl,
			targetInvitationId,
			assetsForDbUpsert,
			params.assetRefs,
		);
	}

	if (shouldUpsertDraft) {
		const draftId = existingDraft ? (existingDraft.id as string) : randomUUID();
		const resetDraftSql = `update public.invitation_content_drafts set status = 'draft', content = ${sqlLiteral(JSON.stringify(targetDraftContent))}::jsonb, submission_id = null, updated_at = now(), deleted_at = null where invitation_project_id = '${targetInvitationId}'::uuid;`;
		if (runPsql(resetDraftSql, targetDbUrl).stdout.includes('UPDATE 0') || !existingDraft) {
			runPsql(
				`insert into public.invitation_content_drafts (id, invitation_project_id, submission_id, content, status) values ('${draftId}'::uuid, '${targetInvitationId}'::uuid, null, ${sqlLiteral(JSON.stringify(targetDraftContent))}::jsonb, 'draft');`,
				targetDbUrl,
			);
		}
		count++;
	}

	if (shouldPublish) {
		const selectDraftRes = runPsql(
			`select id, updated_at::text from public.invitation_content_drafts where invitation_project_id = '${targetInvitationId}'::uuid and deleted_at is null limit 1;`,
			targetDbUrl,
			{ tuplesOnly: true },
		);
		const draftParts = selectDraftRes.stdout
			.trim()
			.split('|')
			.map((s) => s.trim());
		executePublicationRpcCall(
			params,
			draftParts[0] || randomUUID(),
			draftParts[1]?.split('\n')[0]?.trim() || new Date().toISOString(),
		);
		count++;
	}

	if (shouldUpsertEvent) {
		const eventRes = runPsql(
			`insert into public.events (id, owner_user_id, slug, event_type, title, status, invitation_project_id) values (gen_random_uuid(), '${ownerUserId}'::uuid, ${sqlLiteral(slug)}, ${sqlLiteral(eventType)}, ${sqlLiteral(pkg.event?.title ?? pkg.invitation.title)}, 'published', '${targetInvitationId}'::uuid) on conflict (slug) do update set title = excluded.title, status = 'published', invitation_project_id = excluded.invitation_project_id, deleted_at = null, updated_at = now() returning id;`,
			targetDbUrl,
			{ tuplesOnly: true },
		);
		const cleanEventId = eventRes.stdout
			.trim()
			.split(/[\r\n\s]+/)[0]
			?.trim();
		if (cleanEventId) {
			runPsql(
				`insert into public.event_memberships (event_id, user_id, membership_role) values ('${cleanEventId}'::uuid, '${ownerUserId}'::uuid, 'owner') on conflict (event_id, user_id) do update set membership_role = 'owner', deleted_at = null;`,
				targetDbUrl,
			);
			count += 2;
		}
	}

	return count;
}

interface TargetScanResult {
	existingInv: Record<string, unknown> | null;
	existingDraft: Record<string, unknown> | null;
	existingPub: Record<string, unknown> | null;
	existingEvent: Record<string, unknown> | null;
	existingMember: Record<string, unknown> | null;
	targetInvitationId: string;
	pubQuery: string;
}

function scanTargetState(
	targetDbUrl: string,
	slug: string,
	eventType: string,
	ownerUserId: string,
	existingInvitation: Record<string, unknown> | null,
): TargetScanResult {
	const existingInv = existingInvitation;
	const targetInvitationId = existingInv ? (existingInv.id as string) : randomUUID();

	const draftResult = runPsql(
		`select row_to_json(t) from (select id, status, updated_at, content from public.invitation_content_drafts where invitation_project_id = '${targetInvitationId}'::uuid and deleted_at is null limit 1) t;`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const existingDraft = draftResult.stdout.trim() ? parsePsqlJson(draftResult.stdout) : null;

	const pubQuery = `select version, updated_at, content from public.published_invitation_content where slug = ${sqlLiteral(slug)} and event_type = ${sqlLiteral(eventType)} and deleted_at is null order by version desc limit 1`;
	const pubResult = runPsql(`select row_to_json(t) from (${pubQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const existingPub = pubResult.stdout.trim() ? parsePsqlJson(pubResult.stdout) : null;

	const eventResult = runPsql(
		`select row_to_json(t) from (select id, owner_user_id, slug, event_type, title, status, invitation_project_id from public.events where slug = ${sqlLiteral(slug)} and deleted_at is null limit 1) t;`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const existingEvent = eventResult.stdout.trim() ? parsePsqlJson(eventResult.stdout) : null;
	if (existingInv && existingEvent && existingEvent.owner_user_id !== ownerUserId) {
		throw new Error(`Target event owner does not match the invitation owner for "${slug}".`);
	}

	let existingMember: Record<string, unknown> | null = null;
	if (existingEvent?.id) {
		const memberResult = runPsql(
			`select row_to_json(t) from (select event_id, user_id, membership_role from public.event_memberships where event_id = '${existingEvent.id}'::uuid and user_id = '${ownerUserId}'::uuid and deleted_at is null limit 1) t;`,
			targetDbUrl,
			{ tuplesOnly: true, throwOnError: false },
		);
		existingMember = memberResult.stdout.trim() ? parsePsqlJson(memberResult.stdout) : null;
	}

	return {
		existingInv,
		existingDraft,
		existingPub,
		existingEvent,
		existingMember,
		targetInvitationId,
		pubQuery,
	};
}

function verifyPostPublication(pubQuery: string, targetDbUrl: string, route: string): number {
	const verifyPubResult = runPsql(`select row_to_json(t) from (${pubQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
	});
	if (!verifyPubResult.stdout.trim())
		throw new Error(
			`Post-publication verification failed: route "${route}" not found in target DB.`,
		);
	const verifyPubRow = parsePsqlJson(verifyPubResult.stdout);
	const verifyContentStr = JSON.stringify(verifyPubRow.content ?? {});

	for (const pattern of [/http:\/\/127\.0\.0\.1:54321/, /http:\/\/localhost:54321/]) {
		if (pattern.test(verifyContentStr))
			throw new Error(
				`Post-publication verification failed: content contains source URL matching ${pattern}.`,
			);
	}
	return (verifyPubRow.version as number) || 1;
}

function analyzeTargetDrift(
	pkg: InvitationPackageData,
	targetStorageUrl: string,
	targetDbUrl: string,
	ownerUserId: string,
	assetRefs: UploadedAssetMap,
	existingInvitation: Record<string, unknown> | null,
) {
	const slug = pkg.invitation.slug;
	const eventType = pkg.invitation.eventType;
	const route = `/${eventType}/${slug}`;
	const scanned = scanTargetState(targetDbUrl, slug, eventType, ownerUserId, existingInvitation);
	const targetDraftContent = materializeAssetReferences(pkg.draft.content, assetRefs) as Record<
		string,
		unknown
	>;
	const targetPublishedContent = materializeAssetReferences(
		pkg.publishedContent?.content ?? pkg.draft.content,
		assetRefs,
	) as Record<string, unknown>;

	checkTargetDivergenceConflict(
		slug,
		targetDraftContent,
		scanned.existingDraft,
		scanned.existingPub,
	);

	const isInvMetadataIdentical = checkInvitationMetadataIdentical(
		pkg.invitation,
		scanned.existingInv,
		targetStorageUrl,
	);
	const isDraftIdentical = checkDraftContentIdentical(
		targetDraftContent,
		scanned.existingDraft,
		targetStorageUrl,
	);
	const isPubIdentical = checkPublishedContentIdentical(
		targetPublishedContent,
		scanned.existingPub,
		targetStorageUrl,
		isInvMetadataIdentical,
	);
	const isEventAndMemberIdentical = checkEventAndMembershipIdentical(
		pkg,
		ownerUserId,
		scanned.targetInvitationId,
		scanned.existingEvent,
		scanned.existingMember,
	);

	return {
		slug,
		eventType,
		route,
		targetInvitationId: scanned.targetInvitationId,
		pubQuery: scanned.pubQuery,
		existingInv: scanned.existingInv,
		existingDraft: scanned.existingDraft,
		existingPub: scanned.existingPub,
		existingEvent: scanned.existingEvent,
		existingMember: scanned.existingMember,
		targetDraftContent,
		targetPublishedContent,
		isInvMetadataIdentical,
		isDraftIdentical,
		isPubIdentical,
		isEventAndMemberIdentical,
	};
}

function resolveTargetAssetRefs(
	pkg: InvitationPackageData,
	targetDbUrl: string,
	invitationId: string,
	targetStorageUrl: string,
): UploadedAssetMap {
	const result = runPsql(
		`select json_agg(t) from (select id, storage_path from public.invitation_assets where invitation_id = '${invitationId}'::uuid and deleted_at is null) t;`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	const existing = new Map(
		parsePsqlJsonArray(result.stdout).map((row) => [
			row.storage_path as string,
			row.id as string,
		]),
	);
	return Object.fromEntries(
		pkg.assets.map((asset) => [
			asset.key,
			{
				type: 'uploaded' as const,
				assetId: existing.get(asset.storagePath) ?? randomUUID(),
				src: `${targetStorageUrl}/${asset.storagePath}`,
			},
		]),
	);
}

// ---------------------------------------------------------------------------
// Main Importer
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- Ordered target validation, planning, writes, and verification are intentionally one safety boundary.
export async function runImportEngine(options: ImportEngineOptions): Promise<ImportEngineResult> {
	const {
		packagePath,
		target: expectedTarget,
		ownerUserId: explicitOwnerId,
		dryRun = true,
		targetDbUrl,
	} = options;
	if (Boolean(packagePath) === Boolean(options.packageData)) {
		throw new Error('Provide exactly one of packagePath or packageData.');
	}
	const pkg = packagePath
		? validatePackage(packagePath)
		: validatePackageData(options.packageData!);
	const validatedUrls = validateEnvironmentUrlsPreflight({
		target: expectedTarget,
		targetDbUrl,
		explicitSupabaseUrl: options.targetSupabaseUrl,
	});
	const targetSupabaseUrl = validatedUrls.supabaseUrl;
	const projectRef = validatedUrls.projectRef;
	const targetStorageUrl = validatedUrls.storageUrl;
	const targetClassification = classifyDbTarget(targetDbUrl, { apiUrl: targetSupabaseUrl });
	const identity = resolveTargetIdentity(
		expectedTarget,
		pkg.invitation.slug,
		explicitOwnerId,
		targetDbUrl,
	);
	const ownerUserId = identity.ownerUserId;

	const initialScan = scanTargetState(
		targetDbUrl,
		pkg.invitation.slug,
		pkg.invitation.eventType,
		ownerUserId,
		identity.existingInvitation,
	);
	const assetRefs = resolveTargetAssetRefs(
		pkg,
		targetDbUrl,
		initialScan.targetInvitationId,
		targetStorageUrl,
	);
	const drift = analyzeTargetDrift(
		pkg,
		targetStorageUrl,
		targetDbUrl,
		ownerUserId,
		assetRefs,
		identity.existingInvitation,
	);
	const {
		assetsToUpload,
		assetsToUpsertDbOnly,
		assetActions,
		verifiedAssetHashes,
		assetStateHash,
	} = await scanAssetStatus(
		pkg.assets,
		targetStorageUrl,
		targetDbUrl,
		drift.targetInvitationId,
		options.assetPolicy ?? 'missing',
		options.pruneAssets ?? false,
	);
	const actions = buildResourceActions({
		slug: drift.slug,
		route: drift.route,
		targetInvitationId: drift.targetInvitationId,
		existingInv: drift.existingInv,
		isInvMetadataIdentical: drift.isInvMetadataIdentical,
		assetActions,
		existingDraft: drift.existingDraft,
		isDraftIdentical: drift.isDraftIdentical,
		existingPub: drift.existingPub,
		isPubIdentical: drift.isPubIdentical,
		existingEvent: drift.existingEvent,
		isEventAndMemberIdentical: drift.isEventAndMemberIdentical,
	});
	const hasManagedChanges = actions.some(
		(action) => action.action === 'create' || action.action === 'replace',
	);
	const provenanceExists =
		runPsql(
			`select exists (select 1 from public.managed_invitation_release_provenance where invitation_id = '${drift.targetInvitationId}'::uuid);`,
			targetDbUrl,
			{ tuplesOnly: true },
		).stdout.trim() === 't';
	if (hasManagedChanges) {
		if (expectedTarget === 'preview') {
			actions.push(
				{
					resource: 'preview_identity',
					name: 'Rol administrativo de Preview',
					action: 'replace',
					detail: 'Verificar el rol del propietario dedicado de Preview',
				},
				{
					resource: 'preview_identity',
					name: 'Perfil anfitrión de Preview',
					action: 'replace',
					detail: 'Verificar el perfil anfitrión dedicado de Preview',
				},
			);
		}
		actions.push({
			resource: 'managed_invitation_release_provenance',
			name: 'Procedencia de la versión administrada',
			action: provenanceExists ? 'replace' : 'create',
			detail: 'Registrar la identidad del paquete ejecutado',
		});
	}

	const plannedMutations = actions.filter(
		(act) => act.action === 'create' || act.action === 'replace',
	).length;
	const isZeroDrift = plannedMutations === 0;
	const targetVersion = drift.existingPub ? (drift.existingPub.version as number) : 1;
	const projectedVersion = drift.isPubIdentical
		? targetVersion
		: drift.existingPub
			? targetVersion + 1
			: 1;
	const functionalChanges = buildSemanticFunctionalChanges({
		sourceContent: drift.targetPublishedContent,
		targetContent: (drift.existingPub?.content as Record<string, unknown> | undefined) ?? null,
		assetActions,
	});
	const targetPreconditions = {
		sourceHash: pkg.sourceHash,
		packageHash: pkg.packageHash,
		verifiedProjectRef: projectRef,
		targetInvitationId: drift.targetInvitationId,
		existingDraftUpdatedAt: drift.existingDraft?.updated_at as string | undefined,
		existingPublishedVersion: drift.existingPub?.version as number | undefined,
		assetStateHash,
	};
	const operationFingerprint = createHash('sha256')
		.update(
			JSON.stringify(
				actions.map(({ resource, name, action }) => ({ resource, name, action })),
			),
		)
		.digest('hex');
	const planId = computePlanId({
		slug: drift.slug,
		sourceHash: pkg.sourceHash,
		targetEnvironment: expectedTarget,
		projectRef,
		changes: functionalChanges,
		preconditions: targetPreconditions,
		operationFingerprint,
	});
	const databaseActions = actions.filter(
		(action) =>
			action.resource !== 'invitation_assets' &&
			(action.action === 'create' || action.action === 'replace'),
	);
	const assetDbActions = assetActions.filter(
		(action) => action.action === 'create' || action.action === 'replace',
	);
	const currentPlan: OperationalPlan = {
		planId,
		invitationSlug: drift.slug,
		invitationTitle: pkg.invitation.title,
		sourceHash: pkg.sourceHash,
		packageHash: pkg.packageHash,
		targetEnvironment: expectedTarget,
		verifiedProjectRef: projectRef,
		functionalChanges,
		physicalDatabaseOps: {
			inserts:
				databaseActions.filter((action) => action.action === 'create').length +
				assetDbActions.filter((action) => action.action === 'create').length,
			updates:
				databaseActions.filter((action) => action.action === 'replace').length +
				assetDbActions.filter((action) => action.action === 'replace').length,
			deletes: 0,
		},
		storageOps: {
			uploads: assetActions.filter((action) => action.action === 'create').length,
			overwrites:
				assetsToUpload.length -
				assetActions.filter((action) => action.action === 'create').length,
			moves: 0,
			deletes: 0,
		},
		targetPreconditions,
		sensitivityClassification: 'public',
		executionStatus: isZeroDrift ? 'IN_SYNC' : 'PLANNED',
	};

	if (!dryRun) {
		if (!options.plan) {
			throw new Error(
				'PRECONDITION_FAILED: Apply requires the exact target plan produced by preflight.',
			);
		}
		const precheck = verifyPlanPreconditions(options.plan, {
			sourceHash: pkg.sourceHash,
			packageHash: pkg.packageHash,
			verifiedProjectRef: projectRef,
			targetInvitationId: drift.targetInvitationId,
			existingDraftUpdatedAt: drift.existingDraft?.updated_at as string | undefined,
			existingPublishedVersion: drift.existingPub?.version as number | undefined,
			assetStateHash,
		});
		if (!precheck.ok) throw new Error(precheck.reason);
		if (options.plan.planId !== currentPlan.planId) {
			throw new Error(
				'PRECONDITION_FAILED: The planned functional or technical operation set changed before execution.',
			);
		}
	}
	const executionPlan = options.plan ?? currentPlan;

	if (dryRun || isZeroDrift) {
		return {
			packageHash: pkg.packageHash,
			slug: drift.slug,
			target: targetClassification.target,
			projectRef,
			ownerUserId,
			publishedVersion: dryRun ? projectedVersion : targetVersion,
			projectionHash: hashPublicationProjection(drift.targetPublishedContent),
			route: drift.route,
			actions,
			plannedMutations,
			executedMutations: 0,
			isZeroDrift,
			mutationsPerformed: 0,
			verifiedAssetHashes,
			isZeroDriftRerun: isZeroDrift,
			functionalChanges,
			plan: executionPlan,
			receipt: isZeroDrift
				? {
						planId: executionPlan.planId,
						executedAt: new Date().toISOString(),
						status: 'IN_SYNC',
						completedOperations: 0,
						publishedVersion: targetVersion,
					}
				: undefined,
		};
	}

	// ── APPLY PHASE ───────────────────────────────────────────────────────
	const trackedResources: TrackedResource[] = [];
	if (expectedTarget === 'preview') {
		trackedResources.push(
			{
				type: 'preview_identity',
				id: `app_user_roles:${ownerUserId}`,
				isPreExisting: true,
				wasOverwritten: false,
			},
			{
				type: 'preview_identity',
				id: `host_profiles:${ownerUserId}`,
				isPreExisting: true,
				wasOverwritten: false,
			},
		);
	}
	trackedResources.push({
		type: 'managed_invitation_release_provenance',
		id: drift.targetInvitationId,
		isPreExisting: provenanceExists,
		wasOverwritten: false,
	});
	if (drift.existingInv && !drift.isInvMetadataIdentical)
		trackedResources.push({
			type: 'invitation',
			id: drift.targetInvitationId,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (drift.existingEvent && !drift.isEventAndMemberIdentical)
		trackedResources.push({
			type: 'event',
			id: drift.existingEvent.id as string,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (drift.existingDraft && !drift.isDraftIdentical)
		trackedResources.push({
			type: 'invitation_content_draft',
			id: drift.existingDraft.id as string,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (drift.existingMember && drift.existingEvent && !drift.isEventAndMemberIdentical)
		trackedResources.push({
			type: 'event_membership',
			id: `${String(drift.existingEvent.id)}:${ownerUserId}`,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (drift.existingPub && !drift.isPubIdentical)
		trackedResources.push({
			type: 'published_invitation_content',
			id: drift.targetInvitationId,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (!drift.existingInv)
		trackedResources.push({
			type: 'invitation',
			id: drift.targetInvitationId,
			isPreExisting: false,
		});
	for (const asset of assetsToUpload) {
		const plannedAssetAction = assetActions.find((action) => action.name === asset.displayName);
		trackedResources.push({
			type: 'storage_object',
			id: asset.storagePath,
			isPreExisting: plannedAssetAction?.action !== 'create',
			wasOverwritten: false,
		});
		const ref = assetRefs[asset.key];
		if (ref?.assetId) {
			trackedResources.push({
				type: 'invitation_asset',
				id: ref.assetId,
				isPreExisting: plannedAssetAction?.action !== 'create',
				wasOverwritten: false,
			});
		}
	}
	for (const asset of assetsToUpsertDbOnly) {
		const ref = assetRefs[asset.key];
		if (ref?.assetId) {
			trackedResources.push({
				type: 'invitation_asset',
				id: ref.assetId,
				isPreExisting: true,
				wasOverwritten: false,
			});
		}
	}
	const markPlannedOverwrites = (types: TrackedResource['type'][]): void => {
		for (const resource of trackedResources) {
			if (resource.isPreExisting && types.includes(resource.type)) {
				resource.wasOverwritten = true;
			}
		}
	};
	const markResourceOverwritten = (type: TrackedResource['type'], id: string): void => {
		const resource = trackedResources.find(
			(candidate) => candidate.type === type && candidate.id === id,
		);
		if (resource?.isPreExisting) resource.wasOverwritten = true;
	};

	let mutationStarted = false;
	let executedMutations = 0;
	let completedDatabaseWrites = { inserts: 0, updates: 0, deletes: 0 };
	let completedStorageMutations = { uploads: 0, overwrites: 0, moves: 0, deletes: 0 };
	try {
		assertDraftRevisionUnchanged(targetDbUrl, drift.existingDraft);
		if (expectedTarget === 'preview') {
			updatePreviewAdminRole(targetDbUrl, ownerUserId);
			mutationStarted = true;
			executedMutations++;
			completedDatabaseWrites.updates++;
			markResourceOverwritten('preview_identity', `app_user_roles:${ownerUserId}`);
			ensureHostProfile(targetDbUrl, ownerUserId);
			executedMutations++;
			completedDatabaseWrites.updates++;
			markResourceOverwritten('preview_identity', `host_profiles:${ownerUserId}`);
		}
		const serviceRoleKey =
			options.serviceRoleKey ||
			getSecretFromEnvOrFiles('PREVIEW_SUPABASE_SERVICE_ROLE_KEY', PREVIEW_SECRET_FILES);

		if (assetsToUpload.length > 0) {
			mutationStarted = true;
			markPlannedOverwrites(['storage_object']);
			const uploadRes = await uploadAndVerifyAssets(
				assetsToUpload,
				targetSupabaseUrl,
				targetStorageUrl,
				serviceRoleKey,
			);
			Object.assign(verifiedAssetHashes, uploadRes.verifiedAssetHashes);
			executedMutations += uploadRes.uploadedCount;
			completedStorageMutations = {
				uploads: assetActions.filter((action) => action.action === 'create').length,
				overwrites: assetActions.filter((action) => action.action === 'replace').length,
				moves: 0,
				deletes: 0,
			};
		}
		mutationStarted = true;
		markPlannedOverwrites([
			'invitation',
			'event',
			'event_membership',
			'invitation_asset',
			'invitation_content_draft',
			'published_invitation_content',
		]);
		const dbMutations = executeDatabaseUpserts({
			targetDbUrl,
			targetInvitationId: drift.targetInvitationId,
			ownerUserId,
			slug: drift.slug,
			eventType: drift.eventType,
			pkg,
			targetSnapshot: rewritePackageStorageUrls(
				pkg.invitation.snapshot,
				targetStorageUrl,
			) as Record<string, unknown>,
			targetDraftContent: drift.targetDraftContent,
			targetPublishedContent: drift.targetPublishedContent,
			existingDraft: drift.existingDraft,
			existingPub: drift.existingPub,
			shouldUpsertInv: !drift.isInvMetadataIdentical || !drift.existingInv,
			assetsForDbUpsert: [...assetsToUpload, ...assetsToUpsertDbOnly],
			shouldUpsertDraft: !drift.isDraftIdentical || !drift.existingDraft,
			shouldPublish: !drift.isPubIdentical || !drift.existingPub,
			shouldUpsertEvent: !drift.isEventAndMemberIdentical,
			assetRefs,
		});
		executedMutations += dbMutations;
		completedDatabaseWrites = {
			inserts: executionPlan.physicalDatabaseOps.inserts - (provenanceExists ? 0 : 1),
			updates: executionPlan.physicalDatabaseOps.updates - (provenanceExists ? 1 : 0),
			deletes: executionPlan.physicalDatabaseOps.deletes,
		};

		const finalPublishedVersion =
			!drift.isPubIdentical || !drift.existingPub
				? verifyPostPublication(drift.pubQuery, targetDbUrl, drift.route)
				: targetVersion;
		const finalAssetRefs = resolveTargetAssetRefs(
			pkg,
			targetDbUrl,
			drift.targetInvitationId,
			targetStorageUrl,
		);
		const finalDrift = analyzeTargetDrift(
			pkg,
			targetStorageUrl,
			targetDbUrl,
			ownerUserId,
			finalAssetRefs,
			identity.existingInvitation,
		);
		const finalAssets = await scanAssetStatus(
			pkg.assets,
			targetStorageUrl,
			targetDbUrl,
			finalDrift.targetInvitationId,
			options.assetPolicy ?? 'missing',
			options.pruneAssets ?? false,
		);
		if (
			!finalDrift.isInvMetadataIdentical ||
			!finalDrift.isDraftIdentical ||
			!finalDrift.isPubIdentical ||
			!finalDrift.isEventAndMemberIdentical ||
			finalAssets.assetsToUpload.length > 0 ||
			finalAssets.assetsToUpsertDbOnly.length > 0
		) {
			throw new Error(
				'Final target verification failed; managed-release provenance was not recorded.',
			);
		}
		// managed_invitation_release_provenance.projection_hash has a check constraint requiring
		// 64-char SHA-256 hex. The package carries an MD5 projectionHash (32 chars) for the
		// publish_invitation_atomic RPC. Derive the provenance value by SHA-256 hashing the MD5.
		const provenanceProjectionHash = createHash('sha256')
			.update(pkg.projectionHash)
			.digest('hex');
		markResourceOverwritten('managed_invitation_release_provenance', drift.targetInvitationId);
		runPsql(
			`insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, applied_at) values ('${drift.targetInvitationId}'::uuid, ${sqlLiteral(pkg.sourceSlug)}, ${sqlLiteral(pkg.schemaVersion)}, ${sqlLiteral(pkg.sourceHash)}, ${sqlLiteral(pkg.packageHash)}, ${sqlLiteral(pkg.metadataHash)}, ${sqlLiteral(provenanceProjectionHash)}, ${sqlLiteral(pkg.assetManifestHash)}, now()) on conflict (invitation_id) do update set definition_slug = excluded.definition_slug, release_schema_version = excluded.release_schema_version, source_hash = excluded.source_hash, package_hash = excluded.package_hash, metadata_hash = excluded.metadata_hash, projection_hash = excluded.projection_hash, asset_manifest_hash = excluded.asset_manifest_hash, applied_at = excluded.applied_at;`,
			targetDbUrl,
		);
		executedMutations++;
		if (provenanceExists) completedDatabaseWrites.updates++;
		else completedDatabaseWrites.inserts++;
		return {
			packageHash: pkg.packageHash,
			slug: drift.slug,
			target: targetClassification.target,
			projectRef,
			ownerUserId,
			publishedVersion: finalPublishedVersion,
			projectionHash: hashPublicationProjection(drift.targetPublishedContent),
			route: drift.route,
			actions,
			plannedMutations,
			executedMutations,
			isZeroDrift: false,
			mutationsPerformed: executedMutations,
			verifiedAssetHashes,
			isZeroDriftRerun: false,
			functionalChanges,
			plan: executionPlan,
			receipt: {
				planId: executionPlan.planId,
				executedAt: new Date().toISOString(),
				status: 'EXECUTED',
				completedOperations: executedMutations,
				publishedVersion: finalPublishedVersion,
			},
		};
	} catch (err) {
		const cleanupResult = await cleanupHostedPsqlResources(
			targetDbUrl,
			drift.slug,
			trackedResources,
		);
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\x1b[31m[Import Engine Failure]\x1b[0m ${redactCredentials(message)}`);
		const recoveryStatus =
			cleanupResult.status === 'CAMBIOS_REVERTIDOS'
				? 'ERROR — CAMBIOS REVERTIDOS'
				: 'ERROR — REQUIERE REVISIÓN';
		const wrapped = new Error(`[${recoveryStatus}] ${message}`, { cause: err });
		(wrapped as unknown as Record<string, unknown>).recoveryStatus = recoveryStatus;
		(wrapped as unknown as Record<string, unknown>).cleanupResult = cleanupResult;
		(wrapped as unknown as Record<string, unknown>).mutationStarted = mutationStarted;
		(wrapped as unknown as Record<string, unknown>).executionTotals = {
			completedOperations: executedMutations,
			databaseWrites: completedDatabaseWrites,
			storageMutations: completedStorageMutations,
		};
		throw wrapped;
	}
}
