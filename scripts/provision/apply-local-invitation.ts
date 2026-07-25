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
/* eslint-disable max-lines -- Application engine sequences checks, dry-run plan, asset processing, draft upsert, and RPC publish. */

import { createHash, randomUUID } from 'node:crypto';

function deriveDeterministicUuid(namespace: string, seed: string): string {
	const hash = createHash('sha256').update(`celebra-me:${namespace}:${seed}`).digest('hex');
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import {
	hashPublicMetadata,
	hashPublicationProjection,
} from '../../src/lib/intake/services/publication-diff.service.ts';
import { checkTargetDivergenceConflict } from './promotion-comparison.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import {
	buildNormalizedInvitationRelease,
	canonicalize,
	materializeAssetReferences,
	type NormalizedInvitationAsset,
} from './normalized-invitation-release.ts';
import { serializeInvitationPackage } from './invitation-package.ts';
import type { UploadedAssetMap } from './invitations/invitation-definition.ts';
import { cleanupLocalResources, type TrackedResource } from './managed-invitation-cleanup.ts';
import { resolveLocalEnv } from './local-provision-env.ts';
import { uploadOrReconcileCloudinaryAsset } from './cloudinary-adapter.ts';

const BUCKET = 'invitation-assets';

import {
	buildSemanticFunctionalChanges,
	computePlanId,
	verifyPlanPreconditions,
	type FunctionalChange,
	type OperationalPlan,
} from './invitation-update-plan.ts';

import { apply3WaySemanticPatch, type UpdateScope } from './semantic-delta.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';

interface ApplyLocalOptions {
	slug: string;
	sourceDir?: string;
	ownerUserId?: string;
	apply?: boolean;
	projectRoot?: string;
	plan?: OperationalPlan;
	updateScope?: UpdateScope;
	assetPolicy?: AssetPolicy;
}

export interface LocalApplyResult {
	slug: string;
	route: string;
	target: 'persistent-local';
	invitationId: string;
	ownerUserId: string;
	publishedVersion: number;
	isZeroDrift: boolean;
	plannedOperations: number;
	completedOperations: number;
	databaseInserts: number;
	databaseUpdates: number;
	databaseDeletes: number;
	storageUploads: number;
	storageOverwrites: number;
	storageMoves: number;
	storageDeletes: number;
	actions: Array<{ resource: string; name: string; action: string; detail: string }>;
	functionalChanges: FunctionalChange[];
	plan: OperationalPlan;
	receipt?: {
		planId: string;
		executedAt: string;
		status: string;
		completedOperations: number;
	};
}

// ---------------------------------------------------------------------------
// Owner Resolution
// ---------------------------------------------------------------------------

async function resolveLocalOwner(
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
		throw new Error(
			`Explicit local owner UUID "${explicitOwnerId}" does not have an eligible role.`,
		);
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

type VerificationAsset = NormalizedInvitationAsset & { imageHash: string };

interface FinalAssetVerificationContext {
	asset: VerificationAsset;
	slug: string;
	apiUrl: string;
	assetsByPath: Map<string, Record<string, unknown>>;
	assetsByDisplayName: Map<string, Record<string, unknown>>;
}

function hasMatchingAssetMetadata(row: Record<string, unknown>, asset: VerificationAsset): boolean {
	return (
		row.display_name === asset.displayName &&
		row.default_alt_text === asset.alt &&
		row.mime_type === asset.mimeType &&
		Number(row.file_size) === asset.fileSize &&
		Number(row.width) === asset.width &&
		Number(row.height) === asset.height &&
		Number(row.validation_version) === asset.validationVersion &&
		row.original_mime_type === asset.originalMimeType &&
		Number(row.original_file_size) === asset.originalFileSize
	);
}

async function isReachable(url: string): Promise<boolean> {
	try {
		const response = await fetch(url);
		return response.ok;
	} catch {
		return false;
	}
}

async function hasMatchingStoredHash(url: string, expectedHash: string): Promise<boolean> {
	try {
		const response = await fetch(url);
		if (!response.ok) return false;
		const actualHash = createHash('sha256')
			.update(new Uint8Array(await response.arrayBuffer()))
			.digest('hex');
		return actualHash === expectedHash;
	} catch {
		return false;
	}
}

async function verifyFinalAsset({
	asset,
	slug,
	apiUrl,
	assetsByPath,
	assetsByDisplayName,
}: FinalAssetVerificationContext): Promise<boolean> {
	// Prefer the managed canonical path, then a pre-existing row matched by display name.
	const managedPath = `managed/${slug}/${asset.key}.webp`;
	const row = assetsByPath.get(managedPath) || assetsByDisplayName.get(asset.displayName);
	if (!row || !hasMatchingAssetMetadata(row, asset)) return false;

	if (row.provider === 'cloudinary' || row.secure_url) {
		const secureUrl = row.secure_url as string;
		const rowSha = row.sha256 as string;
		if (!secureUrl || !secureUrl.startsWith('https://res.cloudinary.com')) return false;
		if (rowSha && rowSha !== asset.imageHash) return false;
		return isReachable(secureUrl);
	}

	const actualPath = (row.storage_path as string) || managedPath;
	const publicUrl = `${apiUrl}/storage/v1/object/public/${BUCKET}/${actualPath}`;
	return hasMatchingStoredHash(publicUrl, asset.imageHash);
}

// ---------------------------------------------------------------------------
// Core Application Engine
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- Application engine sequences checks, dry-run plan, asset processing, draft upsert, and RPC publish.
export async function applyLocalInvitation(options: ApplyLocalOptions): Promise<LocalApplyResult> {
	const { slug, sourceDir, ownerUserId: explicitOwnerId, apply = false } = options;
	const isApply = apply;

	const env = resolveLocalEnv(options.projectRoot);
	const supabase = createClient(env.apiUrl, env.serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const definition = getInvitationDefinition(slug);
	const ownerUserId = await resolveLocalOwner(supabase, explicitOwnerId);
	const release = await buildNormalizedInvitationRelease({ slug, sourceDir });
	const packageHash = serializeInvitationPackage(release).packageHash;
	const preset = findDemoPreset(definition.baseDemoId);
	if (!preset || preset.themeId !== definition.themeId) {
		throw new Error(`Demo preset "${definition.baseDemoId}" is invalid or theme mismatch.`);
	}
	const normalizedPhotos = release.assets.map((asset) => ({ ...asset, imageHash: asset.sha256 }));

	const route = `/${definition.eventType}/${definition.slug}`;

	// Check existing invitation
	const { data: existingInv } = await supabase
		.from('invitations')
		.select(
			'id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by',
		)
		.eq('slug', slug)
		.is('archived_at', null)
		.maybeSingle();

	const invitationId = (existingInv?.id as string) || deriveDeterministicUuid('invitation', slug);

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
	const { data: existingEvent } = await supabase
		.from('events')
		.select('id, owner_user_id, event_type, title, status, invitation_project_id')
		.eq('slug', slug)
		.is('deleted_at', null)
		.maybeSingle();
	const { data: existingMembership } = existingEvent?.id
		? await supabase
				.from('event_memberships')
				.select('membership_role')
				.eq('event_id', existingEvent.id)
				.eq('user_id', ownerUserId)
				.is('deleted_at', null)
				.maybeSingle()
		: { data: null };
	const { data: existingProvenance } = await supabase
		.from('managed_invitation_release_provenance')
		.select('invitation_id')
		.eq('invitation_id', invitationId)
		.maybeSingle();

	// Build asset map with uploaded references
	const assetMap = {} as UploadedAssetMap;
	const assetActions: Array<{ resource: string; name: string; action: string; detail: string }> =
		[];
	const currentAssetStates: Array<Record<string, unknown>> = [];

	const { data: existingAssetRows } = await supabase
		.from('invitation_assets')
		.select(
			'id, display_name, default_alt_text, storage_path, mime_type, file_size, width, height, validation_version, original_mime_type, original_file_size, provider, provider_public_id, provider_version, secure_url, sha256, provider_metadata',
		)
		.eq('invitation_id', invitationId)
		.is('deleted_at', null);

	const existingAssetsByPath = new Map(
		((existingAssetRows ?? []) as Array<Record<string, unknown>>).map((r) => [
			(r.provider_public_id as string) || (r.storage_path as string),
			r,
		]),
	);
	const existingAssetsByDisplayName = new Map(
		((existingAssetRows ?? []) as Array<Record<string, unknown>>).map((r) => [
			r.display_name as string,
			r,
		]),
	);

	for (const norm of normalizedPhotos) {
		const existingAsset =
			existingAssetsByPath.get(`managed/${slug}/${norm.key}.webp`) ||
			existingAssetsByDisplayName.get(norm.displayName);
		const assetId =
			(existingAsset?.id as string) ||
			deriveDeterministicUuid('asset', `${slug}:${norm.key}`);
		const useCloudinary =
			slug === 'abril-michelle-becerra-rea' || existingAsset?.provider === 'cloudinary';

		if (useCloudinary) {
			const cRes = await uploadOrReconcileCloudinaryAsset({
				slug,
				key: norm.key,
				displayName: norm.displayName,
				alt: norm.alt,
				bytes: norm.bytes,
				sha256: norm.sha256,
				mimeType: norm.mimeType,
				width: norm.width,
				height: norm.height,
				dryRun: !isApply,
			});

			assetMap[norm.key] = {
				type: 'uploaded',
				assetId,
				src: cRes.secureUrl,
			};

			const isIdentical =
				Boolean(existingAsset) &&
				existingAsset?.provider === 'cloudinary' &&
				(existingAsset.secure_url === cRes.secureUrl ||
					existingAsset.provider_public_id === cRes.publicId) &&
				existingAsset.sha256 === norm.imageHash &&
				existingAsset.default_alt_text === norm.alt &&
				existingAsset.mime_type === norm.mimeType &&
				Number(existingAsset.file_size) === cRes.bytes &&
				Number(existingAsset.width) === cRes.width &&
				Number(existingAsset.height) === cRes.height &&
				Number(existingAsset.validation_version) === norm.validationVersion;

			currentAssetStates.push({
				key: norm.key,
				storagePath: cRes.publicId,
				storageHash: norm.imageHash,
				metadata: existingAsset ?? null,
			});

			if (isIdentical) {
				assetActions.push({
					resource: 'invitation_assets',
					name: norm.displayName,
					action: 'reuse',
					detail: `Cloudinary asset up-to-date (${(cRes.bytes / 1024).toFixed(1)} KB WebP)`,
				});
			} else {
				assetActions.push({
					resource: 'invitation_assets',
					name: norm.displayName,
					action: existingAsset ? 'replace' : 'create',
					detail: `${existingAsset ? 'Update' : 'Upload'} binary to Cloudinary (${(norm.fileSize / 1024).toFixed(1)} KB WebP)`,
				});
			}
		} else {
			const storagePath =
				(existingAsset?.storage_path as string) || `managed/${slug}/${norm.key}.webp`;
			const publicUrl = `${env.apiUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

			assetMap[norm.key] = {
				type: 'uploaded',
				assetId,
				src: publicUrl,
			};

			let storageHash: string | null = null;
			try {
				const response = await fetch(publicUrl);
				if (response.ok)
					storageHash = createHash('sha256')
						.update(new Uint8Array(await response.arrayBuffer()))
						.digest('hex');
			} catch {
				// Missing or unreadable storage is drift and will be repaired on apply.
			}
			const isIdentical =
				Boolean(existingAsset) &&
				storageHash === norm.imageHash &&
				existingAsset!.default_alt_text === norm.alt &&
				existingAsset!.mime_type === norm.mimeType &&
				Number(existingAsset!.file_size) === norm.fileSize &&
				Number(existingAsset!.width) === norm.width &&
				Number(existingAsset!.height) === norm.height &&
				Number(existingAsset!.validation_version) === norm.validationVersion &&
				existingAsset!.original_mime_type === norm.originalMimeType &&
				Number(existingAsset!.original_file_size) === norm.originalFileSize;
			currentAssetStates.push({
				key: norm.key,
				storagePath,
				storageHash,
				metadata: existingAsset ?? null,
			});

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
	}

	const updateScope: UpdateScope = options.updateScope ?? 'content-only';

	let proposedContent: Record<string, unknown>;
	if (
		existingDraft?.content &&
		(updateScope === 'content-only' || updateScope === 'assets-only')
	) {
		const prevCanonical =
			(existingPub?.content as Record<string, unknown>) ??
			(existingDraft.content as Record<string, unknown>);
		const currCanonical = materializeAssetReferences(release.draftContent, assetMap) as Record<
			string,
			unknown
		>;
		const patchRes = apply3WaySemanticPatch({
			previousCanonical: prevCanonical,
			currentCanonical: currCanonical,
			currentTarget: existingDraft.content as Record<string, unknown>,
			scope: updateScope,
			targetName: slug,
		});
		if (patchRes.blocked) {
			throw new Error(patchRes.blockReason ?? 'Asset preservation violation detected.');
		}
		proposedContent = patchRes.patchedContent;
	} else {
		proposedContent = materializeAssetReferences(release.draftContent, assetMap) as Record<
			string,
			unknown
		>;
	}
	const isInvitationIdentical = Boolean(
		existingInv &&
		existingInv.title === definition.title &&
		existingInv.event_type === definition.eventType &&
		existingInv.base_demo_id === definition.baseDemoId &&
		existingInv.theme_id === definition.themeId &&
		canonicalize(existingInv.snapshot) === canonicalize(preset) &&
		existingInv.kind === 'client' &&
		existingInv.client_name === definition.clientName &&
		existingInv.client_email === (definition.clientEmail ?? '') &&
		existingInv.client_whatsapp === (definition.clientWhatsapp ?? '') &&
		existingInv.photos_received === (definition.photosReceived ?? true) &&
		existingInv.created_by === ownerUserId,
	);
	const isEventIdentical = Boolean(
		existingEvent &&
		existingEvent.owner_user_id === ownerUserId &&
		existingEvent.event_type === definition.eventType &&
		existingEvent.title === definition.title &&
		existingEvent.status === 'published' &&
		existingEvent.invitation_project_id === invitationId,
	);
	const isMembershipIdentical = existingMembership?.membership_role === 'owner';

	// Divergence check
	checkTargetDivergenceConflict(
		slug,
		proposedContent,
		existingDraft
			? {
					status: existingDraft.status as string,
					content: existingDraft.content as Record<string, unknown>,
					updated_at: existingDraft.updated_at as string,
				}
			: null,
		existingPub ? { content: existingPub.content as Record<string, unknown> } : null,
	);

	const isDraftContentIdentical =
		existingDraft && canonicalize(existingDraft.content) === canonicalize(proposedContent);
	const isPubContentIdentical =
		existingPub && canonicalize(existingPub.content) === canonicalize(proposedContent);

	const actions: Array<{ resource: string; name: string; action: string; detail: string }> = [
		{
			resource: 'invitation',
			name: slug,
			action: !existingInv ? 'create' : isInvitationIdentical ? 'reuse' : 'replace',
			detail: !existingInv
				? `Create invitation record (${invitationId})`
				: isInvitationIdentical
					? `Invitation record up-to-date (${invitationId})`
					: 'Reconcile invitation metadata and owner',
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
			resource: 'events',
			name: slug,
			action: !existingEvent ? 'create' : isEventIdentical ? 'reuse' : 'replace',
			detail: !existingEvent
				? 'Create event ownership record'
				: isEventIdentical
					? 'Event ownership up-to-date'
					: 'Reconcile event ownership and publication identity',
		},
		{
			resource: 'event_memberships',
			name: `${slug}-owner`,
			action: !existingMembership ? 'create' : isMembershipIdentical ? 'reuse' : 'replace',
			detail: !existingMembership
				? 'Create owner membership'
				: isMembershipIdentical
					? 'Owner membership up-to-date'
					: 'Restore owner membership role',
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
	const hasManagedChanges = actions.some(
		(action) => action.action === 'create' || action.action === 'replace',
	);
	if (hasManagedChanges) {
		actions.push({
			resource: 'managed_invitation_release_provenance',
			name: 'Procedencia de la versión administrada',
			action: existingProvenance ? 'replace' : 'create',
			detail: 'Registrar la identidad del paquete ejecutado',
		});
	}

	const plannedOperations = actions.filter(
		(a) => a.action === 'create' || a.action === 'replace',
	).length;
	const isZeroDrift = plannedOperations === 0;
	const currentVersion = (existingPub?.version as number) || 1;
	const targetVersion = isPubContentIdentical
		? currentVersion
		: existingPub
			? currentVersion + 1
			: 1;

	// Calculate estimated DB and Storage metrics for dry-run / reporting
	const estInserts =
		(!existingInv ? 1 : 0) +
		assetActions.filter((a) => a.action === 'create').length +
		(!existingDraft ? 1 : 0) +
		(!isPubContentIdentical || !existingPub ? 1 : 0) +
		(!existingEvent ? 1 : 0) +
		(!existingMembership ? 1 : 0) +
		(hasManagedChanges && !existingProvenance ? 1 : 0);
	const estUpdates =
		(existingInv && !isInvitationIdentical ? 1 : 0) +
		assetActions.filter((a) => a.action === 'replace').length +
		(existingDraft && !isDraftContentIdentical ? 1 : 0) +
		(existingEvent && !isEventIdentical ? 1 : 0) +
		(existingMembership && !isMembershipIdentical ? 1 : 0) +
		(hasManagedChanges && existingProvenance ? 1 : 0);
	const estUploads = assetActions.filter((a) => a.action === 'create').length;
	const estOverwrites = assetActions.filter((a) => a.action === 'replace').length;

	const functionalChanges = buildSemanticFunctionalChanges({
		sourceContent: proposedContent,
		targetContent:
			(existingPub?.content as Record<string, unknown> | undefined) ??
			(existingDraft?.content as Record<string, unknown> | undefined) ??
			null,
		assetActions,
	});

	const assetStateHash = createHash('sha256')
		.update(canonicalize(currentAssetStates))
		.digest('hex');
	const targetPreconditions = {
		sourceHash: release.sourceHash,
		packageHash,
		verifiedProjectRef: 'persistent-local',
		targetInvitationId: invitationId,
		existingDraftUpdatedAt: existingDraft?.updated_at as string | undefined,
		existingPublishedVersion: existingPub?.version as number | undefined,
		assetStateHash,
	};

	const computedPlanId = computePlanId({
		slug,
		sourceHash: release.sourceHash,
		targetEnvironment: 'local',
		projectRef: 'persistent-local',
		changes: functionalChanges,
		preconditions: targetPreconditions,
	});

	const currentPlan: OperationalPlan = {
		planId: computedPlanId,
		invitationSlug: slug,
		invitationTitle: definition.title,
		sourceHash: release.sourceHash,
		packageHash,
		targetEnvironment: 'local',
		verifiedProjectRef: 'persistent-local',
		functionalChanges,
		physicalDatabaseOps: { inserts: estInserts, updates: estUpdates, deletes: 0 },
		storageOps: { uploads: estUploads, overwrites: estOverwrites, moves: 0, deletes: 0 },
		targetPreconditions,
		sensitivityClassification: 'public',
		executionStatus: isZeroDrift ? 'IN_SYNC' : 'PLANNED',
	};
	const constructedPlan = options.plan ?? currentPlan;

	if (isApply && options.plan) {
		const precheck = verifyPlanPreconditions(options.plan, {
			sourceHash: release.sourceHash,
			packageHash,
			verifiedProjectRef: 'persistent-local',
			targetInvitationId: invitationId,
			existingDraftUpdatedAt: existingDraft?.updated_at as string | undefined,
			existingPublishedVersion: existingPub?.version as number | undefined,
			assetStateHash,
		});
		if (!precheck.ok) {
			throw new Error(
				precheck.reason ?? 'PRECONDITION_FAILED: Target state changed after planning.',
			);
		}
		if (options.plan.planId !== currentPlan.planId) {
			throw new Error(
				'PRECONDITION_FAILED: The planned functional or technical operation set changed before execution.',
			);
		}
	}

	if (!isApply || isZeroDrift) {
		return {
			slug,
			route,
			target: 'persistent-local',
			invitationId,
			ownerUserId,
			publishedVersion: targetVersion,
			isZeroDrift,
			plannedOperations,
			completedOperations: 0,
			databaseInserts: estInserts,
			databaseUpdates: estUpdates,
			databaseDeletes: 0,
			storageUploads: estUploads,
			storageOverwrites: estOverwrites,
			storageMoves: 0,
			storageDeletes: 0,
			actions,
			functionalChanges,
			plan: constructedPlan,
		};
	}

	// ── APPLY MUTATIONS ──────────────────────────────────────────────────
	const trackedResources: TrackedResource[] = [];
	if (hasManagedChanges && existingProvenance)
		trackedResources.push({
			type: 'managed_invitation_release_provenance',
			id: invitationId,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (existingInv)
		trackedResources.push({
			type: 'invitation',
			id: invitationId,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (existingEvent)
		trackedResources.push({
			type: 'event',
			id: existingEvent.id as string,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (existingMembership)
		trackedResources.push({
			type: 'event_membership',
			id: `${existingEvent?.id as string}:${ownerUserId}`,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (existingDraft)
		trackedResources.push({
			type: 'invitation_content_draft',
			id: existingDraft.id as string,
			isPreExisting: true,
			wasOverwritten: false,
		});
	if (existingPub)
		trackedResources.push({
			type: 'published_invitation_content',
			id: invitationId,
			isPreExisting: true,
			wasOverwritten: false,
		});
	for (const [pathKey, assetRow] of existingAssetsByPath.entries()) {
		trackedResources.push({
			type: 'invitation_asset',
			id: assetRow.id as string,
			isPreExisting: true,
			wasOverwritten: false,
		});
		trackedResources.push({
			type: 'storage_object',
			id: pathKey,
			isPreExisting: true,
			wasOverwritten: false,
		});
	}
	const markOverwritten = (type: TrackedResource['type'], id: string): void => {
		const resource = trackedResources.find(
			(candidate) => candidate.type === type && candidate.id === id,
		);
		if (resource?.isPreExisting) resource.wasOverwritten = true;
	};

	try {
		// 1. Ensure Invitation Record
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

		if (existingInv && !isInvitationIdentical) {
			// Already flagged as isPreExisting at line 387 — no tracking push needed.
			const { error } = await supabase
				.from('invitations')
				.update(invMetadata)
				.eq('id', invitationId);
			if (error) throw error;
			markOverwritten('invitation', invitationId);
		} else if (!existingInv) {
			const { error } = await supabase
				.from('invitations')
				.insert({ id: invitationId, slug, ...invMetadata });
			if (error) throw error;
			trackedResources.push({ type: 'invitation', id: invitationId, isPreExisting: false });
		}

		// 2. Storage Uploads & Metadata Upserts
		for (const norm of normalizedPhotos) {
			const assetRef = assetMap[norm.key];
			const existing =
				existingAssetsByPath.get(`managed/${slug}/${norm.key}.webp`) ||
				existingAssetsByDisplayName.get(norm.displayName);
			const useCloudinary =
				slug === 'abril-michelle-becerra-rea' || existing?.provider === 'cloudinary';

			if (useCloudinary) {
				const cRes = await uploadOrReconcileCloudinaryAsset({
					slug,
					key: norm.key,
					displayName: norm.displayName,
					alt: norm.alt,
					bytes: norm.bytes,
					sha256: norm.sha256,
					mimeType: norm.mimeType,
					dryRun: false,
				});

				const isIdentical =
					Boolean(existing) &&
					existing?.provider === 'cloudinary' &&
					(existing.secure_url === cRes.secureUrl ||
						existing.provider_public_id === cRes.publicId) &&
					existing.sha256 === norm.imageHash &&
					existing.default_alt_text === norm.alt &&
					existing.mime_type === norm.mimeType &&
					Number(existing.file_size) === cRes.bytes &&
					Number(existing.width) === cRes.width &&
					Number(existing.height) === cRes.height &&
					Number(existing.validation_version) === norm.validationVersion;

				if (!isIdentical) {
					const assetMetadata = {
						invitation_id: invitationId,
						display_name: norm.displayName,
						default_alt_text: norm.alt,
						bucket: BUCKET,
						storage_path: cRes.publicId,
						mime_type: norm.mimeType,
						width: cRes.width,
						height: cRes.height,
						file_size: cRes.bytes,
						validation_version: norm.validationVersion,
						original_mime_type: norm.originalMimeType,
						original_file_size: norm.originalFileSize,
						provider: 'cloudinary',
						provider_public_id: cRes.publicId,
						provider_version: cRes.version,
						secure_url: cRes.secureUrl,
						sha256: norm.sha256,
						provider_metadata: cRes.metadata,
					};

					if (existing) {
						const { error } = await supabase
							.from('invitation_assets')
							.update(assetMetadata)
							.eq('id', assetRef.assetId);
						if (error) throw error;
						markOverwritten('invitation_asset', assetRef.assetId);
					} else {
						const { error } = await supabase
							.from('invitation_assets')
							.insert({ id: assetRef.assetId, ...assetMetadata });
						if (error) throw error;
						trackedResources.push({
							type: 'invitation_asset',
							id: assetRef.assetId,
							isPreExisting: false,
						});
					}
				}
			} else {
				const storagePath =
					(existing?.storage_path as string) || `managed/${slug}/${norm.key}.webp`;
				let storageHash: string | null = null;
				try {
					const response = await fetch(assetRef.src);
					if (response.ok)
						storageHash = createHash('sha256')
							.update(new Uint8Array(await response.arrayBuffer()))
							.digest('hex');
				} catch {
					// Missing or unreadable storage is drift and will be repaired below.
				}
				const isIdentical =
					existing &&
					storageHash === norm.imageHash &&
					existing.default_alt_text === norm.alt &&
					existing.mime_type === norm.mimeType &&
					Number(existing.file_size) === norm.fileSize &&
					Number(existing.width) === norm.width &&
					Number(existing.height) === norm.height &&
					Number(existing.validation_version) === norm.validationVersion &&
					existing.original_mime_type === norm.originalMimeType &&
					Number(existing.original_file_size) === norm.originalFileSize;

				if (!isIdentical) {
					const { error: uploadError } = await supabase.storage
						.from(BUCKET)
						.upload(storagePath, norm.bytes, {
							contentType: norm.mimeType,
							upsert: true,
						});
					if (uploadError) throw uploadError;
					if (existing) markOverwritten('storage_object', storagePath);
					if (!existing)
						trackedResources.push({
							type: 'storage_object',
							id: storagePath,
							isPreExisting: false,
						});

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
						provider: 'supabase',
						provider_public_id: storagePath,
						sha256: norm.sha256,
					};

					if (existing) {
						const { error } = await supabase
							.from('invitation_assets')
							.update(assetMetadata)
							.eq('id', assetRef.assetId);
						if (error) throw error;
						markOverwritten('invitation_asset', assetRef.assetId);
					} else {
						const { error } = await supabase
							.from('invitation_assets')
							.insert({ id: assetRef.assetId, ...assetMetadata });
						if (error) throw error;
						trackedResources.push({
							type: 'invitation_asset',
							id: assetRef.assetId,
							isPreExisting: false,
						});
					}
				}
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
				markOverwritten('invitation_content_draft', existingDraft.id as string);
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
				trackedResources.push({
					type: 'invitation_content_draft',
					id: newId,
					isPreExisting: false,
				});
			}
		}

		// 4. Publish via atomic RPC if published content changed
		let finalVersion = currentVersion;
		if (!isPubContentIdentical || !existingPub) {
			const { data: pubBaseline } = await supabase
				.from('invitations')
				.select(
					'slug, title, event_type, base_demo_id, theme_id, kind, snapshot, status, archived_at',
				)
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

			const { data: pubResult, error: pubError } = await supabase.rpc(
				'publish_invitation_atomic',
				{
					p_invitation_id: invitationId,
					p_draft_id: draftId!,
					p_expected_draft_updated_at: draftUpdatedAt!,
					p_expected_published_version: existingPub
						? (existingPub.version as number)
						: null,
					p_public_metadata_hash: publicMetaHash,
					p_projection_hash: projectionHash,
					p_idempotency_key: randomUUID(),
					p_slug: slug,
					p_event_type: definition.eventType,
					p_is_demo: false,
					p_content: proposedContent,
				},
			);

			if (pubError) throw pubError;
			if (existingPub) markOverwritten('published_invitation_content', invitationId);
			finalVersion = pubResult?.publishedContent?.version ?? targetVersion;
		}

		// 5. Upsert Event and Membership
		let eventId = existingEvent?.id as string | undefined;
		if (!eventId) {
			const { data: currentEvent } = await supabase
				.from('events')
				.select('id')
				.eq('slug', slug)
				.is('deleted_at', null)
				.maybeSingle();
			if (currentEvent?.id) {
				eventId = currentEvent.id as string;
			}
		}

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
			trackedResources.push({ type: 'event', id: eventId, isPreExisting: false });
		} else if (!isEventIdentical) {
			const { error: eventError } = await supabase
				.from('events')
				.update({
					owner_user_id: ownerUserId,
					event_type: definition.eventType,
					title: definition.title,
					status: 'published',
					invitation_project_id: invitationId,
				})
				.eq('id', eventId);
			if (eventError) throw eventError;
			markOverwritten('event', eventId);
		}

		if (!existingMembership) {
			const { error: membershipError } = await supabase
				.from('event_memberships')
				.insert({ event_id: eventId, user_id: ownerUserId, membership_role: 'owner' });
			if (membershipError) throw membershipError;
			trackedResources.push({
				type: 'event_membership',
				id: `${eventId}:${ownerUserId}`,
				isPreExisting: false,
			});
		} else if (!isMembershipIdentical) {
			const { error: membershipError } = await supabase
				.from('event_memberships')
				.update({ membership_role: 'owner', deleted_at: null })
				.eq('event_id', eventId)
				.eq('user_id', ownerUserId);
			if (membershipError) throw membershipError;
			markOverwritten('event_membership', `${eventId}:${ownerUserId}`);
		}

		const [
			finalInvitation,
			finalDraft,
			finalPublication,
			finalAssets,
			finalEvent,
			finalMembership,
		] = await Promise.all([
			supabase
				.from('invitations')
				.select(
					'title, event_type, base_demo_id, theme_id, kind, client_name, client_email, client_whatsapp, photos_received, created_by',
				)
				.eq('id', invitationId)
				.single(),
			supabase
				.from('invitation_content_drafts')
				.select('content')
				.eq('invitation_project_id', invitationId)
				.is('deleted_at', null)
				.maybeSingle(),
			supabase
				.from('published_invitation_content')
				.select('content')
				.eq('invitation_project_id', invitationId)
				.is('deleted_at', null)
				.order('version', { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase
				.from('invitation_assets')
				.select(
					'display_name, default_alt_text, storage_path, mime_type, file_size, width, height, validation_version, original_mime_type, original_file_size, provider, provider_public_id, secure_url, sha256',
				)
				.eq('invitation_id', invitationId)
				.is('deleted_at', null),
			supabase
				.from('events')
				.select('id, owner_user_id, event_type, title, status, invitation_project_id')
				.eq('slug', slug)
				.is('deleted_at', null)
				.maybeSingle(),
			supabase
				.from('event_memberships')
				.select('membership_role')
				.eq('event_id', eventId)
				.eq('user_id', ownerUserId)
				.is('deleted_at', null)
				.maybeSingle(),
		]);
		if (
			finalInvitation.error ||
			finalDraft.error ||
			finalPublication.error ||
			finalAssets.error ||
			finalEvent.error ||
			finalMembership.error
		) {
			throw new Error(
				'Final Local verification query failed; managed-release provenance was not recorded.',
			);
		}
		const finalInvitationRow = finalInvitation.data as Record<string, unknown> | null;
		const finalAssetsByPath = new Map(
			((finalAssets.data ?? []) as Array<Record<string, unknown>>).map((a) => [
				(a.provider_public_id as string) || (a.storage_path as string),
				a,
			]),
		);
		const finalAssetsByDisplayName = new Map(
			((finalAssets.data ?? []) as Array<Record<string, unknown>>).map((a) => [
				a.display_name as string,
				a,
			]),
		);
		const assetsVerified = await Promise.all(
			normalizedPhotos.map((asset) =>
				verifyFinalAsset({
					asset,
					slug,
					apiUrl: env.apiUrl,
					assetsByPath: finalAssetsByPath,
					assetsByDisplayName: finalAssetsByDisplayName,
				}),
			),
		);
		const finalEventRow = finalEvent.data as Record<string, unknown> | null;
		const verified = Boolean(
			finalInvitationRow &&
			finalInvitationRow.title === definition.title &&
			finalInvitationRow.event_type === definition.eventType &&
			finalInvitationRow.base_demo_id === definition.baseDemoId &&
			finalInvitationRow.theme_id === definition.themeId &&
			finalInvitationRow.kind === 'client' &&
			finalInvitationRow.client_name === definition.clientName &&
			finalInvitationRow.client_email === (definition.clientEmail ?? '') &&
			finalInvitationRow.client_whatsapp === (definition.clientWhatsapp ?? '') &&
			finalInvitationRow.photos_received === (definition.photosReceived ?? true) &&
			finalInvitationRow.created_by === ownerUserId &&
			canonicalize(finalDraft.data?.content) === canonicalize(proposedContent) &&
			canonicalize(finalPublication.data?.content) === canonicalize(proposedContent) &&
			finalEventRow?.owner_user_id === ownerUserId &&
			finalEventRow.event_type === definition.eventType &&
			finalEventRow.title === definition.title &&
			finalEventRow.status === 'published' &&
			finalEventRow.invitation_project_id === invitationId &&
			finalMembership.data?.membership_role === 'owner' &&
			assetsVerified.every(Boolean),
		);
		if (!verified)
			throw new Error(
				'Final Local verification failed; managed-release provenance was not recorded.',
			);

		const { error: provenanceError } = await supabase
			.from('managed_invitation_release_provenance')
			.upsert({
				invitation_id: invitationId,
				definition_slug: release.slug,
				release_schema_version: release.schemaVersion,
				source_hash: release.sourceHash,
				package_hash: packageHash,
				metadata_hash: release.metadataHash,
				// SHA-256 of the materialized proposed content (the provenance table check constraint
				// requires 64-char hex; release.projectionHash is MD5/32-char for the RPC).
				projection_hash: createHash('sha256')
					.update(canonicalize(proposedContent))
					.digest('hex'),
				asset_manifest_hash: release.assetManifestHash,
				applied_at: new Date().toISOString(),
			});
		if (provenanceError) throw provenanceError;
		if (existingProvenance) {
			markOverwritten('managed_invitation_release_provenance', invitationId);
		} else {
			trackedResources.push({
				type: 'managed_invitation_release_provenance',
				id: invitationId,
				isPreExisting: false,
			});
		}

		return {
			slug,
			route,
			target: 'persistent-local',
			invitationId,
			ownerUserId,
			publishedVersion: finalVersion,
			isZeroDrift: false,
			plannedOperations,
			completedOperations: plannedOperations,
			databaseInserts: estInserts,
			databaseUpdates: estUpdates,
			databaseDeletes: 0,
			storageUploads: estUploads,
			storageOverwrites: estOverwrites,
			storageMoves: 0,
			storageDeletes: 0,
			actions,
			functionalChanges,
			plan: constructedPlan,
			receipt: {
				planId: constructedPlan.planId,
				executedAt: new Date().toISOString(),
				status: 'CAMBIOS APLICADOS',
				completedOperations: plannedOperations,
			},
		};
	} catch (err) {
		const mutatedResources = trackedResources.filter(
			(resource) => !resource.isPreExisting || resource.wasOverwritten,
		);
		const storageResources = mutatedResources.filter(
			(resource) => resource.type === 'storage_object',
		);
		const databaseResources = mutatedResources.filter(
			(resource) => resource.type !== 'storage_object',
		);
		const cleanupRes = await cleanupLocalResources(supabase, slug, trackedResources);
		const recoveryStatus =
			cleanupRes.status === 'CAMBIOS_REVERTIDOS'
				? 'ERROR — CAMBIOS REVERTIDOS'
				: 'ERROR — REQUIERE REVISIÓN';
		const detailedError = new Error(
			`[${recoveryStatus}] ${err instanceof Error ? err.message : String(err)}`,
			{ cause: err },
		);
		(detailedError as unknown as Record<string, unknown>).recoveryStatus = recoveryStatus;
		(detailedError as unknown as Record<string, unknown>).cleanupResult = cleanupRes;
		(detailedError as unknown as Record<string, unknown>).mutationStarted =
			mutatedResources.length > 0;
		(detailedError as unknown as Record<string, unknown>).executionTotals = {
			completedOperations: mutatedResources.length,
			databaseWrites: {
				inserts: databaseResources.filter((resource) => !resource.isPreExisting).length,
				updates: databaseResources.filter((resource) => resource.isPreExisting).length,
				deletes: 0,
			},
			storageMutations: {
				uploads: storageResources.filter((resource) => !resource.isPreExisting).length,
				overwrites: storageResources.filter((resource) => resource.isPreExisting).length,
				moves: 0,
				deletes: 0,
			},
		};
		throw detailedError;
	}
}
