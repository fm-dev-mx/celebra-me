/**
 * invitation-import-engine.ts — Shared Import Engine for Preview & Production
 *
 * Implements the single generic importer used by Preview and Production promotion workflows.
 * Validates immutable package schema & hashes, classifies targets, resolves ownership,
 * manages Storage binary upload/verification by SHA-256, upserts DB records in FK-safe order,
 * calls canonical publish_invitation_atomic RPC, and verifies the published projection.
 */

import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import type { InvitationPackageData, InvitationPackageAsset } from './invitation-package.ts';
import {
	computePackageHash,
	PACKAGE_SCHEMA_VERSION,
	STORAGE_URL_PLACEHOLDER,
} from './invitation-package.ts';
import {
	classifyDbTarget,
	redactDbUrl,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	type DbTarget,
} from '../db/db-target-config.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import {
	resolvePreviewAdminUser,
	updatePreviewAdminRole,
	ensureHostProfile,
	deriveSupabaseUrlFromDbUrl,
	getProjectRefFromSupabaseUrl,
	buildStorageUrl,
} from '../db/preview-sync-guards.ts';
import {
	hashPublicMetadata,
	hashPublicationProjection,
} from '../../src/lib/intake/services/publication-diff.service.ts';

export interface ImportEngineOptions {
	packagePath: string;
	target: 'preview' | 'production';
	ownerUserId?: string;
	dryRun?: boolean;
	allowDivergentOverwrite?: boolean;
	targetDbUrl: string;
	targetSupabaseUrl?: string;
	serviceRoleKey?: string;
}

export interface ResourcePlanAction {
	resource: string;
	name: string;
	action: 'create' | 'replace' | 'reuse' | 'skip';
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
	mutationsPerformed: number;
	verifiedAssetHashes: Record<string, string>;
	isZeroDriftRerun: boolean;
}

function sha256Bytes(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function parsePsqlJson(stdout: string): Record<string, unknown> {
	const trimmed = stdout.trim();
	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		const jsonStr = trimmed.slice(firstBrace, lastBrace + 1);
		return JSON.parse(jsonStr) as Record<string, unknown>;
	}
	return JSON.parse(trimmed) as Record<string, unknown>;
}

function rewritePackageStorageUrls(val: unknown, targetStorageUrl: string): unknown {
	if (typeof val === 'string') {
		return val.replaceAll(`${STORAGE_URL_PLACEHOLDER}/`, `${targetStorageUrl}/`);
	}
	if (Array.isArray(val)) {
		return val.map((item) => rewritePackageStorageUrls(item, targetStorageUrl));
	}
	if (val !== null && typeof val === 'object') {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(val as Record<string, unknown>)) {
			result[key] = rewritePackageStorageUrls(
				(val as Record<string, unknown>)[key],
				targetStorageUrl,
			);
		}
		return result;
	}
	return val;
}

// ---------------------------------------------------------------------------
// Pipeline Sub-phases
// ---------------------------------------------------------------------------

function validatePackage(packagePath: string): InvitationPackageData {
	if (!existsSync(packagePath)) {
		throw new Error(`Package file does not exist at path: "${packagePath}"`);
	}
	const rawPackageStr = readFileSync(packagePath, 'utf8');
	let pkg: InvitationPackageData;
	try {
		pkg = JSON.parse(rawPackageStr) as InvitationPackageData;
	} catch (err) {
		throw new Error(`Package file at "${packagePath}" is not valid JSON.`, { cause: err });
	}

	if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
		throw new Error(
			`Package schema version mismatch: expected "${PACKAGE_SCHEMA_VERSION}", got "${pkg.schemaVersion}".`,
		);
	}

	const computedHash = computePackageHash(pkg);
	if (computedHash !== pkg.packageHash) {
		throw new Error(
			`Package hash integrity verification failed! Computed ${computedHash}, package claims ${pkg.packageHash}. Package has been tampered with or corrupted.`,
		);
	}

	return pkg;
}

function validateTargetClassification(
	expectedTarget: 'preview' | 'production',
	targetDbUrl: string,
	targetSupabaseUrl: string,
): { targetClassification: ReturnType<typeof classifyDbTarget>; projectRef: string } {
	const targetClassification = classifyDbTarget(targetDbUrl, { apiUrl: targetSupabaseUrl });

	if (expectedTarget === 'preview' && targetClassification.target !== 'preview') {
		throw new Error(
			`Target classification mismatch: expected preview target, classified as "${targetClassification.target}". Target URL: ${redactDbUrl(targetDbUrl)}`,
		);
	}
	if (expectedTarget === 'production' && targetClassification.target !== 'production') {
		throw new Error(
			`Target classification mismatch: expected production target, classified as "${targetClassification.target}". Target URL: ${redactDbUrl(targetDbUrl)}`,
		);
	}

	const projectRef = getProjectRefFromSupabaseUrl(targetSupabaseUrl);
	if (expectedTarget === 'preview' && projectRef !== 'iwipdvisoyerfdytuhwi') {
		throw new Error(
			`Preview promotion safety abort: expected Preview project "iwipdvisoyerfdytuhwi", got "${projectRef}".`,
		);
	}

	return { targetClassification, projectRef };
}

function resolveOwner(
	expectedTarget: 'preview' | 'production',
	explicitOwnerId: string | undefined,
	targetDbUrl: string,
	dryRun: boolean,
): string {
	if (expectedTarget === 'preview') {
		const ownerUserId = resolvePreviewAdminUser(targetDbUrl);
		if (!dryRun) {
			updatePreviewAdminRole(targetDbUrl, ownerUserId);
			ensureHostProfile(targetDbUrl, ownerUserId);
		}
		return ownerUserId;
	}

	if (!explicitOwnerId) {
		throw new Error('Production promotion requires an explicit --owner-user-id <UUID>.');
	}
	const ownerCheck = runPsql(
		`select id from auth.users where id = ${sqlLiteral(explicitOwnerId)};`,
		targetDbUrl,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (!ownerCheck.stdout.trim()) {
		throw new Error(
			`Production owner UUID "${explicitOwnerId}" does not exist in target auth.users table.`,
		);
	}
	return explicitOwnerId;
}

async function scanAssetStatus(
	assets: InvitationPackageAsset[],
	targetStorageUrl: string,
): Promise<{
	assetsToUpload: InvitationPackageAsset[];
	assetActions: ResourcePlanAction[];
	verifiedAssetHashes: Record<string, string>;
}> {
	const assetsToUpload: InvitationPackageAsset[] = [];
	const assetActions: ResourcePlanAction[] = [];
	const verifiedAssetHashes: Record<string, string> = {};

	for (const pAsset of assets) {
		const targetAssetUrl = `${targetStorageUrl}/${pAsset.storagePath}`;
		let isIdentical = false;

		try {
			const fetchRes = await fetch(targetAssetUrl);
			if (fetchRes.ok) {
				const ab = await fetchRes.arrayBuffer();
				const targetHash = sha256Bytes(new Uint8Array(ab));
				if (targetHash === pAsset.sha256) {
					isIdentical = true;
					verifiedAssetHashes[pAsset.storagePath] = targetHash;
				}
			}
		} catch {
			// Asset not present on target storage
		}

		if (isIdentical) {
			assetActions.push({
				resource: 'invitation_assets',
				name: pAsset.displayName,
				action: 'reuse',
				detail: `Storage binary up-to-date (SHA-256: ${pAsset.sha256.slice(0, 12)}…)`,
			});
		} else {
			assetsToUpload.push(pAsset);
			assetActions.push({
				resource: 'invitation_assets',
				name: pAsset.displayName,
				action: 'replace',
				detail: `Upload binary to Storage (${(pAsset.fileSize ?? 0) / 1024} KB WebP)`,
			});
		}
	}

	return { assetsToUpload, assetActions, verifiedAssetHashes };
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
		if (!verifyRes.ok) {
			throw new Error(
				`Storage read-back verification failed for "${pAsset.storagePath}" (HTTP ${verifyRes.status}).`,
			);
		}
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
	existingDraft: Record<string, unknown> | null;
	existingPub: Record<string, unknown> | null;
}

function upsertAssetRows(
	targetDbUrl: string,
	targetInvitationId: string,
	assets: InvitationPackageAsset[],
): number {
	let count = 0;
	for (const pAsset of assets) {
		const assetId = randomUUID();
		const assetSql = `
			insert into public.invitation_assets (
				id, invitation_id, display_name, default_alt_text, bucket, storage_path,
				mime_type, width, height, file_size, validation_version, original_mime_type, original_file_size
			) values (
				'${assetId}'::uuid,
				'${targetInvitationId}'::uuid,
				${sqlLiteral(pAsset.displayName)},
				${pAsset.defaultAltText ? sqlLiteral(pAsset.defaultAltText) : 'null'},
				${sqlLiteral(pAsset.bucket)},
				${sqlLiteral(pAsset.storagePath)},
				${sqlLiteral(pAsset.mimeType)},
				${pAsset.width ?? 'null'},
				${pAsset.height ?? 'null'},
				${pAsset.fileSize ?? 'null'},
				${pAsset.validationVersion},
				${pAsset.originalMimeType ? sqlLiteral(pAsset.originalMimeType) : 'null'},
				${pAsset.originalFileSize ?? 'null'}
			)
			on conflict (bucket, storage_path) do update set
				display_name = excluded.display_name,
				default_alt_text = excluded.default_alt_text,
				mime_type = excluded.mime_type,
				width = excluded.width,
				height = excluded.height,
				file_size = excluded.file_size,
				validation_version = excluded.validation_version,
				deleted_at = null,
				updated_at = now();
		`;
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
	const { targetDbUrl, targetInvitationId, slug, eventType, pkg, targetDraftContent } = params;

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
	const projectionHash = hashPublicationProjection(targetDraftContent);
	const idempotencyKey = randomUUID();

	const rpcSql = `
		select row_to_json(t) from (
			select publish_invitation_atomic(
				p_invitation_id => '${targetInvitationId}'::uuid,
				p_draft_id => '${finalDraftId}'::uuid,
				p_expected_draft_updated_at => '${finalDraftUpdatedAt}'::timestamptz,
				p_expected_published_version => ${expectedPublishedVersion ?? 'null'},
				p_public_metadata_hash => ${sqlLiteral(publicMetadataHash)},
				p_projection_hash => ${sqlLiteral(projectionHash)},
				p_idempotency_key => '${idempotencyKey}'::uuid,
				p_slug => ${sqlLiteral(slug)},
				p_event_type => ${sqlLiteral(eventType)},
				p_is_demo => ${pkg.invitation.kind === 'demo' ? 'true' : 'false'},
				p_content => ${sqlLiteral(JSON.stringify(targetDraftContent))}::jsonb
			)
		) t;
	`;
	const rpcResult = runPsql(rpcSql, targetDbUrl, { tuplesOnly: true });
	if (!rpcResult.stdout.trim()) {
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
	} = params;
	let count = 0;

	// Invitation upsert
	const invUpsertSql = `
		insert into public.invitations (
			id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot,
			client_name, client_email, client_whatsapp, photos_received, created_by
		) values (
			'${targetInvitationId}'::uuid,
			${sqlLiteral(slug)},
			${sqlLiteral(pkg.invitation.title)},
			${sqlLiteral(eventType)},
			'draft',
			${sqlLiteral(pkg.invitation.baseDemoId)},
			${sqlLiteral(pkg.invitation.themeId)},
			${sqlLiteral(pkg.invitation.kind)},
			${sqlLiteral(JSON.stringify(targetSnapshot))}::jsonb,
			${sqlLiteral(pkg.invitation.clientName)},
			${sqlLiteral(pkg.invitation.clientEmail)},
			${sqlLiteral(pkg.invitation.clientWhatsapp)},
			${pkg.invitation.photosReceived ? 'true' : 'false'},
			'${ownerUserId}'::uuid
		)
		on conflict (slug) where (archived_at is null) do update set
			title = excluded.title,
			base_demo_id = excluded.base_demo_id,
			theme_id = excluded.theme_id,
			snapshot = excluded.snapshot,
			client_name = excluded.client_name,
			client_email = excluded.client_email,
			client_whatsapp = excluded.client_whatsapp,
			photos_received = excluded.photos_received,
			updated_at = now()
		returning id;
	`;
	runPsql(invUpsertSql, targetDbUrl, { tuplesOnly: true });
	count++;

	count += upsertAssetRows(targetDbUrl, targetInvitationId, pkg.assets);

	// Draft upsert: reset status to draft
	const draftId = existingDraft ? (existingDraft.id as string) : randomUUID();
	const resetDraftSql = `
		update public.invitation_content_drafts
		set status = 'draft',
		    content = ${sqlLiteral(JSON.stringify(targetDraftContent))}::jsonb,
		    submission_id = null,
		    updated_at = now(),
		    deleted_at = null
		where invitation_project_id = '${targetInvitationId}'::uuid;
	`;
	const updateRes = runPsql(resetDraftSql, targetDbUrl);
	if (updateRes.stdout.includes('UPDATE 0') || !existingDraft) {
		const insertDraftSql = `
			insert into public.invitation_content_drafts (
				id, invitation_project_id, submission_id, content, status
			) values (
				'${draftId}'::uuid,
				'${targetInvitationId}'::uuid,
				null,
				${sqlLiteral(JSON.stringify(targetDraftContent))}::jsonb,
				'draft'
			);
		`;
		runPsql(insertDraftSql, targetDbUrl);
	}
	const selectDraftSql = `
		select id, updated_at::text
		from public.invitation_content_drafts
		where invitation_project_id = '${targetInvitationId}'::uuid
		  and deleted_at is null
		limit 1;
	`;
	const selectDraftRes = runPsql(selectDraftSql, targetDbUrl, { tuplesOnly: true });
	const draftParts = selectDraftRes.stdout
		.trim()
		.split('|')
		.map((s) => s.trim());
	const finalDraftId = draftParts[0] || draftId;
	const finalDraftUpdatedAt = draftParts[1]?.split('\n')[0]?.trim() || new Date().toISOString();
	count++;

	executePublicationRpcCall(params, finalDraftId, finalDraftUpdatedAt);
	count++;

	// Event & Event membership upsert
	const eventTitle = pkg.event?.title ?? pkg.invitation.title;
	const eventSql = `
		insert into public.events (
			id, owner_user_id, slug, event_type, title, status, invitation_project_id
		) values (
			gen_random_uuid(),
			'${ownerUserId}'::uuid,
			${sqlLiteral(slug)},
			${sqlLiteral(eventType)},
			${sqlLiteral(eventTitle)},
			'published',
			'${targetInvitationId}'::uuid
		)
		on conflict (slug) do update set
			owner_user_id = excluded.owner_user_id,
			title = excluded.title,
			status = 'published',
			invitation_project_id = excluded.invitation_project_id,
			deleted_at = null,
			updated_at = now()
		returning id;
	`;
	const eventRes = runPsql(eventSql, targetDbUrl, { tuplesOnly: true });
	const cleanEventId = eventRes.stdout
		.trim()
		.split(/[\r\n\s]+/)[0]
		?.trim();
	if (cleanEventId) {
		const memberSql = `
			insert into public.event_memberships (event_id, user_id, membership_role)
			values ('${cleanEventId}'::uuid, '${ownerUserId}'::uuid, 'owner')
			on conflict (event_id, user_id) do update set membership_role = 'owner', deleted_at = null;
		`;
		runPsql(memberSql, targetDbUrl);
		count++;
	}

	return count;
}

interface TargetScanResult {
	existingInv: Record<string, unknown> | null;
	existingDraft: Record<string, unknown> | null;
	existingPub: Record<string, unknown> | null;
	targetInvitationId: string;
	pubQuery: string;
}

function scanTargetState(targetDbUrl: string, slug: string, eventType: string): TargetScanResult {
	const invQuery = `select id, slug from public.invitations where slug = ${sqlLiteral(slug)} and archived_at is null limit 1`;
	const invResult = runPsql(`select row_to_json(t) from (${invQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const existingInv = invResult.stdout.trim() ? parsePsqlJson(invResult.stdout) : null;
	const targetInvitationId = existingInv ? (existingInv.id as string) : randomUUID();

	const draftQuery = `select id, status, updated_at, content from public.invitation_content_drafts where invitation_project_id = '${targetInvitationId}'::uuid and deleted_at is null limit 1`;
	const draftResult = runPsql(`select row_to_json(t) from (${draftQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const existingDraft = draftResult.stdout.trim() ? parsePsqlJson(draftResult.stdout) : null;

	const pubQuery = `select version, updated_at, content from public.published_invitation_content where slug = ${sqlLiteral(slug)} and event_type = ${sqlLiteral(eventType)} and deleted_at is null limit 1`;
	const pubResult = runPsql(`select row_to_json(t) from (${pubQuery}) t;`, targetDbUrl, {
		tuplesOnly: true,
		throwOnError: false,
	});
	const existingPub = pubResult.stdout.trim() ? parsePsqlJson(pubResult.stdout) : null;

	return { existingInv, existingDraft, existingPub, targetInvitationId, pubQuery };
}

export function checkTargetDivergenceConflict(
	slug: string,
	targetDraftContent: Record<string, unknown>,
	existingDraft: Record<string, unknown> | null,
	existingPub: Record<string, unknown> | null,
	allowDivergentOverwrite = false,
): void {
	if (!existingDraft || allowDivergentOverwrite) return;

	const draftStatus = existingDraft.status as string;
	if (draftStatus !== 'draft') return;

	const pkgDraftHash = hashPublicationProjection(targetDraftContent);
	const targetDraftHash = hashPublicationProjection(
		(existingDraft.content as Record<string, unknown>) ?? {},
	);
	const targetPubHash = existingPub
		? hashPublicationProjection((existingPub.content as Record<string, unknown>) ?? {})
		: null;

	if (targetDraftHash !== pkgDraftHash && targetDraftHash !== targetPubHash) {
		throw new Error(
			`Target divergence conflict for "${slug}": target draft revision ${String(existingDraft.updated_at ?? existingDraft.id ?? 'unknown')}; target published version ${String(existingPub?.version ?? 'none')}; package content hash ${pkgDraftHash}; target draft hash ${targetDraftHash}; target published hash ${targetPubHash ?? 'none'}. The target draft is considered divergent because it is a draft whose projection differs from both the package and the currently published projection. To replace these target edits, pass --allow-divergent-overwrite and a separate Production-specific confirmation.`,
		);
	}
}

function verifyPostPublication(pubQuery: string, targetDbUrl: string, route: string): number {
	const verifyPubResult = runPsql(pubQuery, targetDbUrl, { tuplesOnly: true });
	if (!verifyPubResult.stdout.trim()) {
		throw new Error(
			`Post-publication verification failed: route "${route}" not found in target DB.`,
		);
	}
	const verifyPubRow = parsePsqlJson(verifyPubResult.stdout);
	const publishedVersion = (verifyPubRow.version as number) || 1;
	const verifyContentStr = JSON.stringify(verifyPubRow.content ?? {});

	const sourceUrlPatterns = [/http:\/\/127\.0\.0\.1:54321/, /http:\/\/localhost:54321/];
	for (const pattern of sourceUrlPatterns) {
		if (pattern.test(verifyContentStr)) {
			throw new Error(
				`Post-publication verification failed: content contains source URL matching ${pattern}.`,
			);
		}
	}
	return publishedVersion;
}

// ---------------------------------------------------------------------------
// Main Importer
// ---------------------------------------------------------------------------

export async function runImportEngine(options: ImportEngineOptions): Promise<ImportEngineResult> {
	const {
		packagePath,
		target: expectedTarget,
		ownerUserId: explicitOwnerId,
		dryRun = true,
		targetDbUrl,
	} = options;

	const pkg = validatePackage(packagePath);
	const targetSupabaseUrl = options.targetSupabaseUrl ?? deriveSupabaseUrlFromDbUrl(targetDbUrl);
	const { targetClassification, projectRef } = validateTargetClassification(
		expectedTarget,
		targetDbUrl,
		targetSupabaseUrl,
	);

	const ownerUserId = resolveOwner(expectedTarget, explicitOwnerId, targetDbUrl, dryRun);
	const targetStorageUrl = buildStorageUrl(targetSupabaseUrl);
	const slug = pkg.invitation.slug;
	const eventType = pkg.invitation.eventType;
	const route = `/${eventType}/${slug}`;

	const actions: ResourcePlanAction[] = [];
	let mutationsPerformed = 0;

	const { existingInv, existingDraft, existingPub, targetInvitationId, pubQuery } =
		scanTargetState(targetDbUrl, slug, eventType);

	const targetDraftContent = rewritePackageStorageUrls(
		pkg.draft.content,
		targetStorageUrl,
	) as Record<string, unknown>;
	const projectionHash = hashPublicationProjection(targetDraftContent);

	checkTargetDivergenceConflict(
		slug,
		targetDraftContent,
		existingDraft,
		existingPub,
		options.allowDivergentOverwrite ?? false,
	);

	actions.push({
		resource: 'invitation',
		name: slug,
		action: existingInv ? 'replace' : 'create',
		detail: existingInv
			? `Reuse existing invitation ID ${targetInvitationId}`
			: `Create new invitation ID ${targetInvitationId}`,
	});

	const { assetsToUpload, assetActions, verifiedAssetHashes } = await scanAssetStatus(
		pkg.assets,
		targetStorageUrl,
	);
	actions.push(...assetActions);

	actions.push({
		resource: 'invitation_content_drafts',
		name: `${slug}-draft`,
		action: existingDraft ? 'replace' : 'create',
		detail: existingDraft ? 'Update content draft' : 'Create content draft',
	});

	actions.push({
		resource: 'published_invitation_content',
		name: route,
		action: existingPub ? 'replace' : 'create',
		detail: existingPub
			? `Publish (version ${(existingPub.version as number) + 1})`
			: 'Publish initial version 1',
	});

	const isZeroDriftRerun =
		Boolean(existingInv) && assetsToUpload.length === 0 && Boolean(existingPub);

	if (dryRun) {
		return {
			packageHash: pkg.packageHash,
			slug,
			target: targetClassification.target,
			projectRef,
			ownerUserId,
			publishedVersion: existingPub ? (existingPub.version as number) : 1,
			projectionHash,
			route,
			actions,
			mutationsPerformed: 0,
			verifiedAssetHashes,
			isZeroDriftRerun,
		};
	}

	// ── APPLY PHASE ───────────────────────────────────────────────────────
	try {
		const serviceRoleKey =
			options.serviceRoleKey ||
			getSecretFromEnvOrFiles('PREVIEW_SUPABASE_SERVICE_ROLE_KEY', PREVIEW_SECRET_FILES);
		const uploadRes = await uploadAndVerifyAssets(
			assetsToUpload,
			targetSupabaseUrl,
			targetStorageUrl,
			serviceRoleKey,
		);
		Object.assign(verifiedAssetHashes, uploadRes.verifiedAssetHashes);
		mutationsPerformed += uploadRes.uploadedCount;

		const targetSnapshot = rewritePackageStorageUrls(
			pkg.invitation.snapshot,
			targetStorageUrl,
		) as Record<string, unknown>;
		const targetDraftContent = rewritePackageStorageUrls(
			pkg.draft.content,
			targetStorageUrl,
		) as Record<string, unknown>;

		mutationsPerformed += executeDatabaseUpserts({
			targetDbUrl,
			targetInvitationId,
			ownerUserId,
			slug,
			eventType,
			pkg,
			targetSnapshot,
			targetDraftContent,
			existingDraft,
			existingPub,
		});

		const publishedVersion = verifyPostPublication(pubQuery, targetDbUrl, route);

		return {
			packageHash: pkg.packageHash,
			slug,
			target: targetClassification.target,
			projectRef,
			ownerUserId,
			publishedVersion,
			projectionHash,
			route,
			actions,
			mutationsPerformed,
			verifiedAssetHashes,
			isZeroDriftRerun,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\x1b[31m[Import Engine Failure]\x1b[0m ${redactDbUrl(message)}`);
		throw new Error(message, { cause: err });
	}
}
