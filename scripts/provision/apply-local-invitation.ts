/**
 * apply-local-invitation.ts — Canonical Persistent-Local Invitation Application Engine
 *
 * Applies a versioned single-file invitation definition (e.g. scripts/provision/invitations/*.ts)
 * to the persistent-local database (127.0.0.1:54322).
 *
 * Safety & Invariants:
 *  - STRICT target verification: persistent-local ONLY (127.0.0.1:54322). Fails closed for remote/Preview/Prod.
 *  - Default mode: --dry-run (0 database or storage writes).
 *  - Mutation mode: requires explicit --apply flag.
 *  - Local dashboard divergence protection: aborts if target draft has unpublished edits.
 *  - Idempotent: safe to re-run against unchanged definitions/photos (reports 0 mutations performed).
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { classifyDbTarget, verifyLocalIdentity } from '../db/db-guard.ts';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import { normalizeInvitationImage } from '../../src/lib/intake/services/asset-policy.ts';
import {
	hashPublicMetadata,
	hashPublicationProjection,
} from '../../src/lib/intake/services/publication-diff.service.ts';
import { checkTargetDivergenceConflict } from './promotion-comparison.ts';
import { hashBytes } from './romina/helpers.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import type {
	InvitationDefinition,
	UploadedAssetMap,
} from './invitations/invitation-definition.ts';

const BUCKET = 'invitation-assets';

export interface ApplyLocalOptions {
	slug: string;
	sourceDir: string;
	ownerUserId?: string;
	apply?: boolean;
	projectRoot?: string;
}

export interface LocalEnv {
	apiUrl: string;
	dbUrl: string;
	serviceRoleKey: string;
}

export interface NormalizedPhotoSpec {
	key: string;
	displayName: string;
	alt: string;
	bytes: Uint8Array;
	mimeType: string;
	width: number;
	height: number;
	fileSize: number;
	validationVersion: number;
	originalMimeType: string;
	originalFileSize: number;
	imageHash: string;
}

export interface LocalApplyResult {
	slug: string;
	route: string;
	target: 'persistent-local';
	invitationId: string;
	ownerUserId: string;
	publishedVersion: number;
	isZeroDrift: boolean;
	plannedMutations: number;
	executedMutations: number;
	mutationsPerformed: number;
	actions: Array<{ resource: string; name: string; action: string; detail: string }>;
}

// ---------------------------------------------------------------------------
// Environment & Local Target Verification
// ---------------------------------------------------------------------------

export function resolveLocalEnv(projectRoot?: string): LocalEnv {
	const root = projectRoot ?? process.cwd();

	let output: string;
	try {
		output = execFileSync('supabase', ['status', '-o', 'json'], {
			cwd: root,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch {
		throw new Error(
			'Local Supabase is required for invitation:apply:local. Refusing to run without local Supabase status.',
		);
	}

	const status = JSON.parse(output) as Record<string, unknown>;
	const apiUrl = status.API_URL as string;
	const dbUrl = status.DB_URL as string;
	const serviceRoleKey = status.SERVICE_ROLE_KEY as string;

	if (typeof apiUrl !== 'string' || typeof dbUrl !== 'string' || typeof serviceRoleKey !== 'string') {
		throw new Error('Local Supabase status is incomplete. Refusing to run.');
	}

	const classification = classifyDbTarget(dbUrl, { apiUrl });
	const identity = verifyLocalIdentity({
		supabaseStatus: output,
		supabaseConfig: fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8'),
	});

	if (classification.target !== 'persistent-local' || !identity.ok) {
		throw new Error(
			`Refusing to run: local target verification failed (${classification.reason}${identity.errors.length ? '; ' + identity.errors.join(' ') : ''}).`,
		);
	}

	return { apiUrl, dbUrl, serviceRoleKey };
}

// ---------------------------------------------------------------------------
// Photo Processing & Asset Verification
// ---------------------------------------------------------------------------

export async function processSourcePhotos(
	definition: InvitationDefinition,
	sourceDir: string,
): Promise<NormalizedPhotoSpec[]> {
	const resolvedDir = path.resolve(sourceDir);
	if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
		throw new Error(`Photo source directory does not exist or is not a directory: ${resolvedDir}`);
	}

	const normalizedList: NormalizedPhotoSpec[] = [];

	for (const spec of definition.assetSpecs) {
		const sourcePath = path.join(resolvedDir, spec.fileName);
		if (!fs.existsSync(sourcePath)) {
			throw new Error(
				`Required source photograph "${spec.fileName}" for asset "${spec.displayName}" missing in ${resolvedDir}`,
			);
		}

		const sourceBytes = fs.readFileSync(sourcePath);
		const normalized = await normalizeInvitationImage(
			new Blob([Uint8Array.from(sourceBytes)], { type: 'image/jpeg' }),
			'image/jpeg',
		);

		const uploadBytes = new Uint8Array(await normalized.blob.arrayBuffer());

		normalizedList.push({
			key: spec.key,
			displayName: spec.displayName,
			alt: spec.alt,
			bytes: uploadBytes,
			mimeType: normalized.mimeType,
			width: normalized.width,
			height: normalized.height,
			fileSize: normalized.fileSize,
			validationVersion: normalized.validationVersion,
			originalMimeType: normalized.originalMimeType,
			originalFileSize: normalized.originalFileSize,
			imageHash: hashBytes(uploadBytes),
		});
	}

	return normalizedList;
}

// ---------------------------------------------------------------------------
// Owner Resolution
// ---------------------------------------------------------------------------

export async function resolveLocalOwner(
	supabase: SupabaseClient,
	explicitOwnerId?: string,
): Promise<string> {
	if (explicitOwnerId) {
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidPattern.test(explicitOwnerId)) {
			throw new Error(`Owner User ID "${explicitOwnerId}" is not a valid UUID.`);
		}
		const { data } = await supabase
			.from('app_user_roles')
			.select('user_id')
			.eq('user_id', explicitOwnerId)
			.maybeSingle();
		if (data?.user_id) return data.user_id as string;
	}

	const { data: adminRole } = await supabase
		.from('app_user_roles')
		.select('user_id')
		.eq('role', 'super_admin')
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (adminRole?.user_id) return adminRole.user_id as string;

	const { data: anyRole } = await supabase
		.from('app_user_roles')
		.select('user_id')
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (anyRole?.user_id) return anyRole.user_id as string;

	throw new Error(
		'No local admin user found in persistent-local database. Run pnpm db:local:bootstrap-admin first.',
	);
}

// ---------------------------------------------------------------------------
// Core Application Engine
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- Application engine sequences checks, dry-run plan, asset processing, draft upsert, and RPC publish.
export async function applyLocalInvitation(options: ApplyLocalOptions): Promise<LocalApplyResult> {
	const { slug, sourceDir, ownerUserId: explicitOwnerId, apply = false } = options;
	const isApply = apply === true;

	const env = resolveLocalEnv(options.projectRoot);
	const supabase = createClient(env.apiUrl, env.serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const definition = getInvitationDefinition(slug);
	const ownerUserId = await resolveLocalOwner(supabase, explicitOwnerId);
	const normalizedPhotos = await processSourcePhotos(definition, sourceDir);

	const route = `/${definition.eventType}/${definition.slug}`;

	// Check existing invitation
	const { data: existingInv } = await supabase
		.from('invitations')
		.select('id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, created_by')
		.eq('slug', slug)
		.is('archived_at', null)
		.maybeSingle();

	const invitationId = (existingInv?.id as string) || randomUUID();

	// Check existing draft & publication for divergence
	const { data: existingDraft } = await supabase
		.from('invitation_content_drafts')
		.select('id, status, content, updated_at')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.maybeSingle();

	const { data: existingPub } = await supabase
		.from('published_invitation_content')
		.select('version, content')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();

	// Build asset map with uploaded references
	const assetMap = {} as UploadedAssetMap;
	const assetActions: Array<{ resource: string; name: string; action: string; detail: string }> = [];

	const { data: existingAssetRows } = await supabase
		.from('invitation_assets')
		.select('id, display_name, storage_path, file_size, width, height')
		.eq('invitation_id', invitationId)
		.is('deleted_at', null);

	const existingAssetsByName = new Map(
		((existingAssetRows ?? []) as Array<Record<string, unknown>>).map((r) => [
			r.display_name as string,
			r,
		]),
	);

	for (const norm of normalizedPhotos) {
		const existingAsset = existingAssetsByName.get(norm.displayName);
		const assetId = (existingAsset?.id as string) || randomUUID();
		const storagePath =
			(existingAsset?.storage_path as string) || `invitations/${invitationId}/optimized/${norm.key}.webp`;
		const publicUrl = `${env.apiUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

		assetMap[norm.key] = {
			type: 'uploaded',
			assetId,
			src: publicUrl,
		};

		const isIdentical =
			existingAsset &&
			Number(existingAsset.file_size) === norm.fileSize &&
			Number(existingAsset.width) === norm.width &&
			Number(existingAsset.height) === norm.height;

		if (isIdentical) {
			assetActions.push({
				resource: 'invitation_assets',
				name: norm.displayName,
				action: 'reuse',
				detail: `Storage binary up-to-date (${(norm.fileSize / 1024).toFixed(1)} KB WebP)`,
			});
		} else {
			assetActions.push({
				resource: 'invitation_assets',
				name: norm.displayName,
				action: existingAsset ? 'replace' : 'create',
				detail: `${existingAsset ? 'Update' : 'Upload'} binary to Storage (${(norm.fileSize / 1024).toFixed(1)} KB WebP)`,
			});
		}
	}

	const proposedContent = definition.buildPublishedContent(assetMap);

	// Divergence check
	checkTargetDivergenceConflict(
		slug,
		proposedContent,
		existingDraft ? { status: existingDraft.status as string, content: existingDraft.content as Record<string, unknown>, updated_at: existingDraft.updated_at as string } : null,
		existingPub ? { content: existingPub.content as Record<string, unknown> } : null,
		false,
	);

	const isDraftContentIdentical =
		existingDraft && JSON.stringify(existingDraft.content) === JSON.stringify(proposedContent);
	const isPubContentIdentical =
		existingPub && JSON.stringify(existingPub.content) === JSON.stringify(proposedContent);

	const actions: Array<{ resource: string; name: string; action: string; detail: string }> = [
		{
			resource: 'invitation',
			name: slug,
			action: !existingInv ? 'create' : 'reuse',
			detail: !existingInv
				? `Create invitation record (${invitationId})`
				: `Invitation record up-to-date (${invitationId})`,
		},
		...assetActions,
		{
			resource: 'invitation_content_drafts',
			name: `${slug}-draft`,
			action: !existingDraft ? 'create' : isDraftContentIdentical ? 'reuse' : 'replace',
			detail: !existingDraft
				? 'Create content draft'
				: isDraftContentIdentical
					? 'Content draft up-to-date'
					: 'Update content draft',
		},
		{
			resource: 'published_invitation_content',
			name: route,
			action: !existingPub ? 'create' : isPubContentIdentical ? 'reuse' : 'replace',
			detail: !existingPub
				? 'Publish initial version 1'
				: isPubContentIdentical
					? `Published content up-to-date (version ${existingPub.version})`
					: `Publish new version ${(existingPub.version as number) + 1}`,
		},
	];

	const plannedMutations = actions.filter(
		(a) => a.action === 'create' || a.action === 'replace',
	).length;
	const isZeroDrift = plannedMutations === 0;
	const currentVersion = (existingPub?.version as number) || 1;
	const targetVersion = isPubContentIdentical ? currentVersion : existingPub ? currentVersion + 1 : 1;

	if (!isApply || isZeroDrift) {
		return {
			slug,
			route,
			target: 'persistent-local',
			invitationId,
			ownerUserId,
			publishedVersion: targetVersion,
			isZeroDrift,
			plannedMutations,
			executedMutations: 0,
			mutationsPerformed: 0,
			actions,
		};
	}

	// ── APPLY MUTATIONS ──────────────────────────────────────────────────
	let executedMutations = 0;

	// 1. Ensure Invitation Record
	const preset = findDemoPreset(definition.baseDemoId);
	if (!preset || preset.themeId !== definition.themeId) {
		throw new Error(`Demo preset "${definition.baseDemoId}" is invalid or theme mismatch.`);
	}

	const invMetadata = {
		title: definition.title,
		event_type: definition.eventType,
		status: 'draft',
		base_demo_id: definition.baseDemoId,
		theme_id: definition.themeId,
		snapshot: preset,
		client_name: definition.clientName,
		client_email: definition.clientEmail ?? '',
		client_whatsapp: definition.clientWhatsapp ?? '',
		photos_received: definition.photosReceived ?? true,
		created_by: ownerUserId,
		kind: 'client',
	};

	if (existingInv) {
		const { error } = await supabase.from('invitations').update(invMetadata).eq('id', invitationId);
		if (error) throw error;
	} else {
		const { error } = await supabase
			.from('invitations')
			.insert({ id: invitationId, slug, ...invMetadata });
		if (error) throw error;
		executedMutations++;
	}

	// 2. Storage Uploads & Metadata Upserts
	for (const norm of normalizedPhotos) {
		const assetRef = assetMap[norm.key];
		const storagePath = `invitations/${invitationId}/optimized/${norm.key}.webp`;

		const existing = existingAssetsByName.get(norm.displayName);
		const isIdentical =
			existing &&
			Number(existing.file_size) === norm.fileSize &&
			Number(existing.width) === norm.width &&
			Number(existing.height) === norm.height;

		if (!isIdentical) {
			const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, norm.bytes, {
				contentType: norm.mimeType,
				upsert: true,
			});
			if (uploadError) throw uploadError;

			const assetMetadata = {
				invitation_id: invitationId,
				display_name: norm.displayName,
				default_alt_text: norm.alt,
				bucket: BUCKET,
				storage_path: storagePath,
				mime_type: norm.mimeType,
				width: norm.width,
				height: norm.height,
				file_size: norm.fileSize,
				validation_version: norm.validationVersion,
				original_mime_type: norm.originalMimeType,
				original_file_size: norm.originalFileSize,
			};

			if (existing) {
				const { error } = await supabase
					.from('invitation_assets')
					.update(assetMetadata)
					.eq('id', assetRef.assetId);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('invitation_assets')
					.insert({ id: assetRef.assetId, ...assetMetadata });
				if (error) throw error;
			}
			executedMutations++;
		}
	}

	// 3. Upsert Draft
	let draftId = existingDraft?.id as string | undefined;
	let draftUpdatedAt = existingDraft?.updated_at as string | undefined;

	if (!isDraftContentIdentical || !existingDraft) {
		if (existingDraft) {
			const { data, error } = await supabase
				.from('invitation_content_drafts')
				.update({ content: proposedContent, status: 'draft', submission_id: null })
				.eq('id', existingDraft.id)
				.select('id, updated_at')
				.single();
			if (error) throw error;
			draftId = data.id as string;
			draftUpdatedAt = data.updated_at as string;
		} else {
			const newId = randomUUID();
			const { data, error } = await supabase
				.from('invitation_content_drafts')
				.insert({
					id: newId,
					invitation_project_id: invitationId,
					submission_id: null,
					content: proposedContent,
					status: 'draft',
				})
				.select('id, updated_at')
				.single();
			if (error) throw error;
			draftId = data.id as string;
			draftUpdatedAt = data.updated_at as string;
		}
		executedMutations++;
	}

	// 4. Publish via atomic RPC if published content changed
	let finalVersion = currentVersion;
	if (!isPubContentIdentical || !existingPub) {
		const { data: pubBaseline } = await supabase
			.from('invitations')
			.select('slug, title, event_type, base_demo_id, theme_id, kind, snapshot, status, archived_at')
			.eq('id', invitationId)
			.single();

		const publicMetaHash = hashPublicMetadata(
			{
				slug: pubBaseline!.slug as string,
				title: pubBaseline!.title as string,
				eventType: pubBaseline!.event_type as string,
				baseDemoId: pubBaseline!.base_demo_id as string,
				themeId: pubBaseline!.theme_id as string,
				kind: pubBaseline!.kind as string,
				snapshot: pubBaseline!.snapshot,
				status: pubBaseline!.status as string,
				archivedAt: (pubBaseline!.archived_at as string) ?? null,
			},
			existingPub?.content as Record<string, unknown> | undefined,
		);

		const projectionHash = hashPublicationProjection(proposedContent);

		const { data: pubResult, error: pubError } = await supabase.rpc('publish_invitation_atomic', {
			p_invitation_id: invitationId,
			p_draft_id: draftId!,
			p_expected_draft_updated_at: draftUpdatedAt!,
			p_expected_published_version: existingPub ? (existingPub.version as number) : null,
			p_public_metadata_hash: publicMetaHash,
			p_projection_hash: projectionHash,
			p_idempotency_key: randomUUID(),
			p_slug: slug,
			p_event_type: definition.eventType,
			p_is_demo: false,
			p_content: proposedContent,
		});

		if (pubError) throw pubError;
		finalVersion = pubResult?.publishedContent?.version ?? targetVersion;
		executedMutations++;
	}

	// 5. Upsert Event and Membership
	const { data: eventRow } = await supabase
		.from('events')
		.select('id')
		.eq('slug', slug)
		.is('deleted_at', null)
		.maybeSingle();

	let eventId = eventRow?.id as string | undefined;
	if (!eventId) {
		eventId = randomUUID();
		const { error: eventError } = await supabase.from('events').insert({
			id: eventId,
			owner_user_id: ownerUserId,
			slug,
			event_type: definition.eventType,
			title: definition.title,
			status: 'published',
			invitation_project_id: invitationId,
		});
		if (eventError) throw eventError;
		executedMutations++;
	}

	const { data: membershipRow } = await supabase
		.from('event_memberships')
		.select('event_id')
		.eq('event_id', eventId)
		.eq('user_id', ownerUserId)
		.is('deleted_at', null)
		.maybeSingle();

	if (!membershipRow) {
		await supabase.from('event_memberships').insert({
			event_id: eventId,
			user_id: ownerUserId,
			membership_role: 'owner',
		});
		executedMutations++;
	}

	return {
		slug,
		route,
		target: 'persistent-local',
		invitationId,
		ownerUserId,
		publishedVersion: finalVersion,
		isZeroDrift: false,
		plannedMutations,
		executedMutations,
		mutationsPerformed: executedMutations,
		actions,
	};
}
