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
import { createClient } from '@supabase/supabase-js';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import {
	hashPublicMetadata,
	hashPublicationProjection,
} from '../../src/lib/intake/services/publication-diff.service.ts';
import { checkTargetDivergenceConflict } from './promotion-comparison.ts';
import {
	isRecoverableManagedPartial,
	resolveManagedMergeBaseline,
	type ManagedBaselineReceiptEvidence,
} from './managed-merge-baseline.ts';
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
import { resolveAndEnsureInvitationHostOwner } from './invitation-host-owner.ts';
import { verifySupabaseApiCredential } from './supabase-credential-verification.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { resolveManagedInvitationMetadata } from '../../src/lib/intake/mutations/ownership.ts';
import { operationIdFromPlanId } from '../../src/lib/intake/mutations/outcome.ts';

const BUCKET = 'invitation-assets';

import {
	buildSemanticFunctionalChanges,
	computePlanId,
	verifyPlanPreconditions,
	type FunctionalChange,
	type OperationalPlan,
} from './invitation-update-plan.ts';

import {
	apply3WaySemanticPatch,
	MergeConflictError,
	type ConflictResolutions,
	type UpdateScope,
} from './semantic-delta.ts';
import {
	collectUploadedAssetIds,
	reconcileAssets,
	type AssetPolicy,
	type ObservedStorageState,
	type TargetAssetRecord,
} from './asset-reconciliation.ts';
import { fingerprintPathPolicy } from './conflict-resolutions.ts';
import { assertManagedContentSchema } from './managed-content-validation.ts';

interface ApplyLocalOptions {
	slug: string;
	rekeyFrom?: string;
	sourceDir?: string;
	ownerUserId?: string;
	apply?: boolean;
	projectRoot?: string;
	plan?: OperationalPlan;
	updateScope?: UpdateScope;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	conflictResolutions?: ConflictResolutions;
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

async function resolveLocalOwner(options: {
	slug: string;
	hostLoginAlias: string;
	displayName: string;
	explicitOwnerId?: string;
	apiUrl: string;
	serviceRoleKey: string;
	dbUrl: string;
	apply: boolean;
	existingOwnerUserId?: string | null;
}): Promise<string> {
	const hostPlan = await resolveAndEnsureInvitationHostOwner({
		slug: options.slug,
		hostLoginAlias: options.hostLoginAlias,
		displayName: options.displayName,
		targetDbUrl: options.dbUrl,
		supabaseUrl: options.apiUrl,
		serviceRoleKey: options.serviceRoleKey,
		explicitOwnerId: options.explicitOwnerId,
		existingOwnerUserId: options.existingOwnerUserId,
		dryRun: !options.apply,
	});
	return hostPlan.ownerUserId;
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
	const release = await buildNormalizedInvitationRelease({ slug, sourceDir });
	const packageHash = serializeInvitationPackage(release).packageHash;
	const preset = findDemoPreset(definition.baseDemoId);
	if (!preset || preset.themeId !== definition.themeId) {
		throw new Error(`Demo preset "${definition.baseDemoId}" is invalid or theme mismatch.`);
	}
	const normalizedPhotos = release.assets.map((asset) => ({ ...asset, imageHash: asset.sha256 }));

	// Check existing invitation
	let existingInv: Record<string, unknown> | null;
	const rekeyFrom = options.rekeyFrom?.trim();

	if (rekeyFrom) {
		if (rekeyFrom === slug) {
			throw new Error(
				`IDENTITY_CONFLICT: Cannot rekey invitation "${slug}" to its own current slug.`,
			);
		}

		const { data: invByOldSlug } = await supabase
			.from('invitations')
			.select(
				'id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by',
			)
			.eq('slug', rekeyFrom)
			.is('archived_at', null)
			.maybeSingle();

		if (!invByOldSlug || !invByOldSlug.id) {
			throw new Error(
				`IDENTITY_NOT_FOUND: Cannot rekey from "${rekeyFrom}". No active invitation found matching slug "${rekeyFrom}".`,
			);
		}

		const { data: collisionInv } = await supabase
			.from('invitations')
			.select('id')
			.eq('slug', slug)
			.neq('id', invByOldSlug.id)
			.is('archived_at', null)
			.maybeSingle();

		if (collisionInv && collisionInv.id) {
			throw new Error(
				`IDENTITY_CONFLICT: Target slug "${slug}" is already assigned to another active invitation (${collisionInv.id}).`,
			);
		}

		existingInv = invByOldSlug;
		console.log(
			`[IDENTITY_REKEY] Rekeying invitation ${invByOldSlug.id}: "${rekeyFrom}" -> "${slug}"`,
		);
	} else {
		const { data: existingProvenanceLink } = await supabase
			.from('managed_invitation_release_provenance')
			.select('invitation_id')
			.eq('definition_slug', slug)
			.maybeSingle();
		const { data: invBySlug } = await supabase
			.from('invitations')
			.select(
				'id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by',
			)
			.eq('slug', slug)
			.is('archived_at', null)
			.maybeSingle();

		if (
			existingProvenanceLink?.invitation_id &&
			invBySlug?.id &&
			existingProvenanceLink.invitation_id !== invBySlug.id
		) {
			throw new Error(
				`IDENTITY_CONFLICT: Ambiguous identity lineage for slug "${slug}". Provenance links to invitation ${existingProvenanceLink.invitation_id}, but active invitation slug matches ${invBySlug.id}.`,
			);
		}

		if (existingProvenanceLink?.invitation_id) {
			const { data: invByProv } = await supabase
				.from('invitations')
				.select(
					'id, slug, title, event_type, status, base_demo_id, theme_id, kind, snapshot, client_name, client_email, client_whatsapp, photos_received, created_by',
				)
				.eq('id', existingProvenanceLink.invitation_id)
				.is('archived_at', null)
				.maybeSingle();
			existingInv = invByProv;
		} else {
			existingInv = invBySlug;
		}
	}

	await verifySupabaseApiCredential({
		apiUrl: env.apiUrl,
		credential: env.serviceRoleKey,
		expectedProjectRef: SUPABASE_PROJECT_REFS.local,
	});

	const ownerUserId = await resolveLocalOwner({
		slug,
		hostLoginAlias: definition.hostLoginAlias,
		displayName: definition.clientName || definition.title,
		explicitOwnerId,
		apiUrl: env.apiUrl,
		serviceRoleKey: env.serviceRoleKey,
		dbUrl: env.dbUrl,
		apply: isApply,
		existingOwnerUserId: existingInv?.created_by ? String(existingInv.created_by) : null,
	});
	const resolvedMetadata = resolveManagedInvitationMetadata(
		{
			title: definition.title,
			slug: definition.slug,
			eventType: definition.eventType,
			baseDemoId: definition.baseDemoId,
			themeId: definition.themeId,
			snapshot: preset as unknown as Record<string, unknown>,
			clientName: definition.clientName,
			clientEmail: definition.clientEmail ?? '',
			clientWhatsapp: definition.clientWhatsapp ?? '',
			photosReceived: definition.photosReceived ?? true,
			ownerUserId,
		},
		existingInv
			? {
					title: String(existingInv.title),
					slug: String(existingInv.slug),
					eventType: String(existingInv.event_type),
					baseDemoId: String(existingInv.base_demo_id),
					themeId: String(existingInv.theme_id),
					snapshot: existingInv.snapshot as Record<string, unknown>,
					clientName: String(existingInv.client_name ?? ''),
					clientEmail: String(existingInv.client_email ?? ''),
					clientWhatsapp: String(existingInv.client_whatsapp ?? ''),
					photosReceived: Boolean(existingInv.photos_received),
					ownerUserId: String(existingInv.created_by),
					status: String(existingInv.status),
				}
			: null,
	);
	// Explicit --rekey-from overrides seed-owned slug preservation so the invitation
	// moves to the definition slug while keeping the same invitation UUID.
	const targetMetadata = rekeyFrom
		? { ...resolvedMetadata, slug: definition.slug }
		: resolvedMetadata;
	const targetSlug = targetMetadata.slug;
	const route = `/${definition.eventType}/${targetSlug}`;

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
		.select('id, version, content, published_at, updated_at, slug')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();
	const { data: existingEvent } = await supabase
		.from('events')
		.select('id, owner_user_id, event_type, title, status, invitation_project_id, slug')
		.eq('invitation_project_id', invitationId)
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
		.select(
			'invitation_id, managed_projection, applied_draft_updated_at, applied_operation_id, applied_published_version, applied_published_projection_hash',
		)
		.eq('invitation_id', invitationId)
		.maybeSingle();
	const appliedOperationId =
		typeof existingProvenance?.applied_operation_id === 'string'
			? existingProvenance.applied_operation_id
			: null;
	const { data: appliedReceiptRow } = appliedOperationId
		? await supabase
				.from('invitation_mutation_operation_receipts')
				.select('operation_id, status, command_kind, origin, completed_steps')
				.eq('operation_id', appliedOperationId)
				.maybeSingle()
		: { data: null };
	const { data: latestReceiptRow } = await supabase
		.from('invitation_mutation_operation_receipts')
		.select('operation_id, status, command_kind, origin, completed_steps, input_hashes')
		.eq('invitation_id', invitationId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	const toReceiptEvidence = (
		row: Record<string, unknown> | null,
	): ManagedBaselineReceiptEvidence | null =>
		row && typeof row.operation_id === 'string' && typeof row.status === 'string'
			? {
					operationId: row.operation_id,
					status: row.status as ManagedBaselineReceiptEvidence['status'],
					commandKind: String(row.command_kind ?? ''),
					origin: typeof row.origin === 'string' ? row.origin : undefined,
					completedSteps: Array.isArray(row.completed_steps)
						? row.completed_steps.filter(
								(step): step is string => typeof step === 'string',
							)
						: [],
					inputHashes:
						row.input_hashes && typeof row.input_hashes === 'object'
							? (row.input_hashes as Record<string, unknown>)
							: undefined,
				}
			: null;
	const latestReceiptEvidence = toReceiptEvidence(
		latestReceiptRow as Record<string, unknown> | null,
	);

	// Build asset map with uploaded references
	const assetMap = {} as UploadedAssetMap;
	const assetActions: Array<{ resource: string; name: string; action: string; detail: string }> =
		[];
	const currentAssetStates: Array<Record<string, unknown>> = [];

	const { data: existingAssetRows } = await supabase
		.from('invitation_assets')
		.select(
			'id, invitation_id, display_name, default_alt_text, storage_path, mime_type, file_size, width, height, validation_version, original_mime_type, original_file_size, provider, provider_public_id, provider_version, secure_url, sha256, provider_metadata, managed_by_definition_slug, managed_source_key, managed_sha256, managed_operation_id',
		)
		.eq('invitation_id', invitationId)
		.is('deleted_at', null);

	const assetRows = Array.isArray(existingAssetRows) ? existingAssetRows : [];
	const existingAssetsByPath = new Map(
		(assetRows as Array<Record<string, unknown>>).map((r) => [
			(r.provider_public_id as string) || (r.storage_path as string),
			r,
		]),
	);
	const existingAssetsByDisplayName = new Map(
		(assetRows as Array<Record<string, unknown>>).map((r) => [r.display_name as string, r]),
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
	const packageCanonicalContent = materializeAssetReferences(
		release.draftContent,
		assetMap,
	) as Record<string, unknown>;
	const packageContentHash = hashPublicationProjection(packageCanonicalContent);

	let proposedContent: Record<string, unknown>;
	if (
		existingDraft?.content &&
		(updateScope === 'content-only' || updateScope === 'assets-only')
	) {
		const recoveringPartial = isRecoverableManagedPartial(latestReceiptEvidence, {
			sourceHash: release.sourceHash,
			packageHash,
		});
		const prevCanonical = resolveManagedMergeBaseline({
			managedProjection: existingProvenance?.managed_projection as
				Record<string, unknown> | null | undefined,
			appliedDraftUpdatedAt:
				typeof existingProvenance?.applied_draft_updated_at === 'string'
					? existingProvenance.applied_draft_updated_at
					: null,
			appliedOperationId,
			appliedPublishedVersion:
				typeof existingProvenance?.applied_published_version === 'number'
					? existingProvenance.applied_published_version
					: null,
			appliedPublishedProjectionHash:
				typeof existingProvenance?.applied_published_projection_hash === 'string'
					? existingProvenance.applied_published_projection_hash
					: null,
			currentDraftUpdatedAt: recoveringPartial
				? (existingProvenance?.applied_draft_updated_at as string)
				: typeof existingDraft.updated_at === 'string'
					? existingDraft.updated_at
					: null,
			currentPublishedVersion: recoveringPartial
				? (existingProvenance?.applied_published_version as number)
				: typeof existingPub?.version === 'number'
					? existingPub.version
					: null,
			currentPublishedProjectionHash: recoveringPartial
				? (existingProvenance?.applied_published_projection_hash as string)
				: existingPub?.content
					? hashPublicationProjection(existingPub.content as Record<string, unknown>)
					: null,
			appliedReceipt: toReceiptEvidence(appliedReceiptRow as Record<string, unknown> | null),
			latestMutationReceipt: recoveringPartial
				? toReceiptEvidence(appliedReceiptRow as Record<string, unknown> | null)
				: latestReceiptEvidence,
		});
		const patchRes = apply3WaySemanticPatch({
			previousCanonical: prevCanonical,
			currentCanonical: packageCanonicalContent,
			currentTarget: existingDraft.content as Record<string, unknown>,
			scope: updateScope,
			targetName: slug,
			resolutions: options.conflictResolutions,
		});
		if (patchRes.blocked) {
			throw new MergeConflictError(
				patchRes.blockReason ?? 'Asset preservation violation detected.',
				patchRes.deltas,
			);
		}
		proposedContent = patchRes.patchedContent;
	} else {
		proposedContent = packageCanonicalContent;
	}
	assertManagedContentSchema(proposedContent);
	const observedStorage: Record<string, ObservedStorageState> = {};
	for (const state of currentAssetStates) {
		observedStorage[String(state.storagePath)] = {
			present: typeof state.storageHash === 'string',
			sha256: typeof state.storageHash === 'string' ? state.storageHash : null,
		};
	}
	for (const row of assetRows as Array<Record<string, unknown>>) {
		const storageIdentity = String(row.provider_public_id || row.storage_path);
		if (observedStorage[storageIdentity]) continue;
		const assetUrl =
			row.provider === 'cloudinary'
				? String(row.secure_url ?? '')
				: `${env.apiUrl}/storage/v1/object/public/${BUCKET}/${String(row.storage_path)}`;
		let present = false;
		let sha256: string | null = null;
		try {
			const response = await fetch(assetUrl);
			present = response.ok;
			if (present) {
				sha256 = createHash('sha256')
					.update(new Uint8Array(await response.arrayBuffer()))
					.digest('hex');
			}
		} catch {
			// An unreadable object is observed as absent; pruning retains target-owned rows.
		}
		observedStorage[storageIdentity] = { present, sha256 };
	}
	const canonicalAssets = normalizedPhotos.map((asset) => ({
		key: asset.key,
		displayName: asset.displayName,
		defaultAltText: asset.alt,
		bucket: BUCKET,
		storagePath: `managed/${slug}/${asset.key}.webp`,
		mimeType: asset.mimeType,
		width: asset.width,
		height: asset.height,
		fileSize: asset.fileSize,
		validationVersion: asset.validationVersion,
		originalMimeType: asset.originalMimeType,
		originalFileSize: asset.originalFileSize,
		sha256: asset.sha256,
		dataBase64: asset.dataBase64,
	}));
	const targetAssetRecords: TargetAssetRecord[] = (
		assetRows as Array<Record<string, unknown>>
	).map((row) => ({
		id: String(row.id),
		invitationId: String(row.invitation_id),
		displayName: String(row.display_name),
		storagePath: String(row.storage_path),
		bucket: String(row.bucket ?? BUCKET),
		mimeType: String(row.mime_type),
		fileSize: typeof row.file_size === 'number' ? row.file_size : null,
		width: typeof row.width === 'number' ? row.width : null,
		height: typeof row.height === 'number' ? row.height : null,
		validationVersion: Number(row.validation_version ?? 0),
		provider: typeof row.provider === 'string' ? row.provider : null,
		providerPublicId:
			typeof row.provider_public_id === 'string' ? row.provider_public_id : null,
		secureUrl: typeof row.secure_url === 'string' ? row.secure_url : null,
		managedByDefinitionSlug:
			typeof row.managed_by_definition_slug === 'string'
				? row.managed_by_definition_slug
				: null,
		managedSourceKey:
			typeof row.managed_source_key === 'string' ? row.managed_source_key : null,
		managedSha256: typeof row.managed_sha256 === 'string' ? row.managed_sha256 : null,
		managedOperationId:
			typeof row.managed_operation_id === 'string' ? row.managed_operation_id : null,
	}));
	const assetReconciliation = reconcileAssets({
		canonicalAssets,
		targetDbAssets: targetAssetRecords,
		observedStorage,
		policy: options.assetPolicy ?? 'missing',
		pruneAssets: options.pruneAssets ?? false,
		definitionSlug: release.slug,
		targetInvitationId: invitationId,
		referencedAssetIds: collectUploadedAssetIds(proposedContent),
	});
	if (assetReconciliation.blocked) {
		throw new Error(assetReconciliation.blockReason ?? 'Asset reconciliation is blocked.');
	}
	const assetsToPrune = assetReconciliation.unreferencedAssets.filter(
		(asset) =>
			asset.plannedAction === 'PRUNE_STORAGE_AND_METADATA' ||
			asset.plannedAction === 'PRUNE_METADATA',
	);
	for (const asset of assetReconciliation.unreferencedAssets) {
		assetActions.push({
			resource: 'invitation_assets',
			name: asset.displayName,
			action: asset.plannedAction.startsWith('PRUNE_') ? 'delete' : 'reuse',
			detail: asset.reason,
		});
	}
	const isInvitationIdentical = Boolean(
		existingInv &&
		existingInv.slug === targetSlug &&
		existingInv.event_type === definition.eventType &&
		existingInv.base_demo_id === definition.baseDemoId &&
		existingInv.theme_id === definition.themeId &&
		canonicalize(existingInv.snapshot) === canonicalize(preset) &&
		existingInv.kind === 'client',
	);
	const isEventIdentical = Boolean(
		existingEvent &&
		existingEvent.slug === targetSlug &&
		existingEvent.owner_user_id === ownerUserId &&
		existingEvent.event_type === definition.eventType &&
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
		existingPub
			? {
					content: existingPub.content as Record<string, unknown>,
					version: existingPub.version,
				}
			: null,
		{
			packageContentHash,
		},
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
		operationFingerprint: fingerprintPathPolicy(options.conflictResolutions),
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
		physicalDatabaseOps: {
			inserts: estInserts,
			updates: estUpdates,
			deletes: assetsToPrune.length,
		},
		storageOps: {
			uploads: estUploads,
			overwrites: estOverwrites,
			moves: 0,
			deletes: assetsToPrune.filter(
				(asset) => asset.plannedAction === 'PRUNE_STORAGE_AND_METADATA',
			).length,
		},
		targetPreconditions,
		sensitivityClassification: 'public',
		executionStatus: isZeroDrift ? 'IN_SYNC' : 'PLANNED',
	};
	const constructedPlan = options.plan ?? currentPlan;
	const rootOperationId = operationIdFromPlanId(constructedPlan.planId);
	const retryParentOperationId = isRecoverableManagedPartial(latestReceiptEvidence, {
		sourceHash: release.sourceHash,
		packageHash,
	})
		? latestReceiptEvidence!.operationId
		: undefined;
	const activeOperationId = retryParentOperationId
		? deriveDeterministicUuid('managed-retry', `${rootOperationId}:${retryParentOperationId}`)
		: rootOperationId;

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
		if (isApply && isZeroDrift) {
			const { error } = await supabase.from('invitation_mutation_operation_receipts').insert({
				operation_id: rootOperationId,
				invitation_id: invitationId,
				environment: 'local',
				project_ref: SUPABASE_PROJECT_REFS.local,
				actor_type: 'operator',
				origin: 'managed_cli_local',
				command_kind: 'managed_invitation_apply',
				input_hashes: { sourceHash: release.sourceHash, packageHash },
				expected_state: constructedPlan.targetPreconditions,
				status: 'replayed',
				completed_steps: ['target_verified', 'existing_result_reused'],
				result: { planId: constructedPlan.planId, publishedVersion: targetVersion },
			});
			if (error && error.code !== '23505') throw error;
		}
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
			databaseDeletes: assetsToPrune.length,
			storageUploads: estUploads,
			storageOverwrites: estOverwrites,
			storageMoves: 0,
			storageDeletes: assetsToPrune.filter(
				(asset) => asset.plannedAction === 'PRUNE_STORAGE_AND_METADATA',
			).length,
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
	let mutationStarted = false;
	const completedSteps = ['target_verified'];

	try {
		// 1. Ensure Invitation Record
		const invMetadata = {
			slug: targetSlug,
			title: targetMetadata.title,
			event_type: definition.eventType,
			status: targetMetadata.status,
			base_demo_id: definition.baseDemoId,
			theme_id: definition.themeId,
			snapshot: preset,
			client_name: targetMetadata.clientName,
			client_email: targetMetadata.clientEmail,
			client_whatsapp: targetMetadata.clientWhatsapp,
			photos_received: targetMetadata.photosReceived,
			created_by: targetMetadata.ownerUserId,
			kind: 'client',
		};

		if (existingInv && !isInvitationIdentical) {
			// Already flagged as isPreExisting at line 387 — no tracking push needed.
			const { error } = await supabase
				.from('invitations')
				.update(invMetadata)
				.eq('id', invitationId);
			if (error) throw error;
			mutationStarted = true;
			completedSteps.push('invitation_metadata_saved');
			markOverwritten('invitation', invitationId);
		} else if (!existingInv) {
			const { error } = await supabase
				.from('invitations')
				.insert({ id: invitationId, ...invMetadata });
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
				if (cRes.action === 'UPLOAD') {
					mutationStarted = true;
					completedSteps.push(`asset_uploaded:${norm.key}`);
				}

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
						managed_by_definition_slug: release.slug,
						managed_source_key: norm.key,
						managed_sha256: norm.sha256,
						managed_operation_id: activeOperationId,
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
					mutationStarted = true;
					completedSteps.push(`asset_metadata_saved:${norm.key}`);
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
					const binaryAlreadyMatches = storageHash === norm.imageHash;
					if (!binaryAlreadyMatches) {
						const { error: uploadError } = await supabase.storage
							.from(BUCKET)
							.upload(storagePath, norm.bytes, {
								contentType: norm.mimeType,
								upsert: true,
							});
						if (uploadError) throw uploadError;
						mutationStarted = true;
						completedSteps.push(`asset_uploaded:${norm.key}`);
						if (existing) markOverwritten('storage_object', storagePath);
						if (!existing)
							trackedResources.push({
								type: 'storage_object',
								id: storagePath,
								isPreExisting: false,
							});
					} else if (!existing) {
						completedSteps.push(`asset_orphan_adopted:${norm.key}`);
					}

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
						managed_by_definition_slug: release.slug,
						managed_source_key: norm.key,
						managed_sha256: norm.sha256,
						managed_operation_id: activeOperationId,
					};

					if (existing) {
						const { error } = await supabase
							.from('invitation_assets')
							.update(assetMetadata)
							.eq('id', assetRef.assetId);
						if (error) throw error;
						mutationStarted = true;
						completedSteps.push(`asset_metadata_saved:${norm.key}`);
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

		// 3. Upsert Draft (conditional on expected revision when updating)
		let draftId = existingDraft?.id as string | undefined;
		let draftUpdatedAt = existingDraft?.updated_at as string | undefined;
		const expectedDraftUpdatedAt =
			constructedPlan.targetPreconditions.existingDraftUpdatedAt ??
			(existingDraft?.updated_at as string | undefined);

		if (!isDraftContentIdentical || !existingDraft) {
			if (existingDraft) {
				if (!expectedDraftUpdatedAt) {
					throw new Error(
						'Target draft update requires an expected revision (updated_at) from the plan.',
					);
				}
				const { data, error } = await supabase
					.from('invitation_content_drafts')
					.update({ content: proposedContent, status: 'draft', submission_id: null })
					.eq('id', existingDraft.id)
					.eq('updated_at', expectedDraftUpdatedAt)
					.select('id, updated_at')
					.maybeSingle();
				if (error) throw error;
				if (!data) {
					throw new Error(
						'Target draft changed after planning; refusing to overwrite a stale revision.',
					);
				}
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

		// 3b. Apply only reviewed, ownership-safe prune actions after the resulting
		// draft is durable. Missing Storage objects converge through metadata-only cleanup.
		for (const planned of assetsToPrune) {
			const record = targetAssetRecords.find((asset) => asset.id === planned.targetAssetId);
			if (!record || record.managedByDefinitionSlug !== release.slug) {
				throw new Error('Managed asset ownership changed after planning.');
			}
			if (planned.plannedAction === 'PRUNE_STORAGE_AND_METADATA') {
				const { error: removeError } = await supabase.storage
					.from(record.bucket)
					.remove([record.storagePath]);
				if (removeError) throw removeError;
				mutationStarted = true;
				completedSteps.push(`asset_storage_pruned:${record.id}`);
				const verifyUrl = `${env.apiUrl}/storage/v1/object/public/${record.bucket}/${record.storagePath}`;
				if (await isReachable(verifyUrl)) {
					throw new Error(
						`Storage prune verification failed for managed asset ${record.id}.`,
					);
				}
			}
			const { data: prunedRow, error: pruneMetadataError } = await supabase
				.from('invitation_assets')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', record.id)
				.eq('invitation_id', invitationId)
				.eq('managed_by_definition_slug', release.slug)
				.is('deleted_at', null)
				.select('id')
				.maybeSingle();
			if (pruneMetadataError) throw pruneMetadataError;
			if (prunedRow) {
				mutationStarted = true;
				completedSteps.push(`asset_metadata_pruned:${record.id}`);
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
					p_slug: targetSlug,
					p_event_type: definition.eventType,
					p_is_demo: false,
					p_content: proposedContent,
				},
			);

			if (pubError) throw pubError;
			if (existingPub) markOverwritten('published_invitation_content', invitationId);
			finalVersion = pubResult?.publishedContent?.version ?? targetVersion;
		} else if (rekeyFrom && existingPub && existingPub.slug !== targetSlug) {
			// Pure identity rekey: keep published version/content, sync route slug only.
			const { error: publishedSlugError } = await supabase
				.from('published_invitation_content')
				.update({ slug: targetSlug })
				.eq('id', existingPub.id as string);
			if (publishedSlugError) throw publishedSlugError;
			mutationStarted = true;
			completedSteps.push('published_slug_rekeyed');
			markOverwritten('published_invitation_content', invitationId);
		}

		// 5. Upsert Event and Membership
		let eventId = existingEvent?.id as string | undefined;
		if (!eventId) {
			const { data: currentEvent } = await supabase
				.from('events')
				.select('id')
				.eq('slug', targetSlug)
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
				slug: targetSlug,
				event_type: definition.eventType,
				title: targetMetadata.title,
				status: 'published',
				invitation_project_id: invitationId,
			});
			if (eventError) throw eventError;
			trackedResources.push({ type: 'event', id: eventId, isPreExisting: false });
		} else if (!isEventIdentical) {
			const { error: eventError } = await supabase
				.from('events')
				.update({
					slug: targetSlug,
					event_type: definition.eventType,
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
				.select('content, updated_at')
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
				.eq('slug', targetSlug)
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
			finalInvitationRow.title === targetMetadata.title &&
			finalInvitationRow.event_type === definition.eventType &&
			finalInvitationRow.base_demo_id === definition.baseDemoId &&
			finalInvitationRow.theme_id === definition.themeId &&
			finalInvitationRow.kind === 'client' &&
			finalInvitationRow.client_name === targetMetadata.clientName &&
			finalInvitationRow.client_email === targetMetadata.clientEmail &&
			finalInvitationRow.client_whatsapp === targetMetadata.clientWhatsapp &&
			finalInvitationRow.photos_received === targetMetadata.photosReceived &&
			finalInvitationRow.created_by === targetMetadata.ownerUserId &&
			canonicalize(finalDraft.data?.content) === canonicalize(proposedContent) &&
			canonicalize(finalPublication.data?.content) === canonicalize(proposedContent) &&
			finalEventRow?.owner_user_id === ownerUserId &&
			finalEventRow.event_type === definition.eventType &&
			finalEventRow.invitation_project_id === invitationId &&
			finalMembership.data?.membership_role === 'owner' &&
			assetsVerified.every(Boolean),
		);
		if (!verified)
			throw new Error(
				'Final Local verification failed; managed-release provenance was not recorded.',
			);

		const appliedDraftUpdatedAt =
			(finalDraft.data?.updated_at as string | undefined) ?? draftUpdatedAt ?? null;
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
				managed_projection: proposedContent,
				applied_draft_updated_at: appliedDraftUpdatedAt,
				applied_operation_id: activeOperationId,
				applied_published_version: finalVersion,
				applied_published_projection_hash: hashPublicationProjection(proposedContent),
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
		const { error: receiptError } = await supabase
			.from('invitation_mutation_operation_receipts')
			.insert({
				operation_id: activeOperationId,
				invitation_id: invitationId,
				environment: 'local',
				project_ref: SUPABASE_PROJECT_REFS.local,
				actor_type: 'operator',
				origin: 'managed_cli_local',
				command_kind: 'managed_invitation_apply',
				input_hashes: { sourceHash: release.sourceHash, packageHash },
				expected_state: constructedPlan.targetPreconditions,
				status: 'applied',
				completed_steps: [
					...completedSteps,
					'content_applied',
					'published',
					'provenance_recorded',
				],
				result: { planId: constructedPlan.planId, publishedVersion: finalVersion },
				retry_of_operation_id: retryParentOperationId ?? null,
			});
		if (receiptError) throw receiptError;

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
			databaseDeletes: assetsToPrune.length,
			storageUploads: estUploads,
			storageOverwrites: estOverwrites,
			storageMoves: 0,
			storageDeletes: assetsToPrune.filter(
				(asset) => asset.plannedAction === 'PRUNE_STORAGE_AND_METADATA',
			).length,
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
		if (mutationStarted) {
			const { error: partialReceiptError } = await supabase
				.from('invitation_mutation_operation_receipts')
				.insert({
					operation_id: activeOperationId,
					invitation_id: invitationId,
					environment: 'local',
					project_ref: SUPABASE_PROJECT_REFS.local,
					actor_type: 'operator',
					origin: 'managed_cli_local',
					command_kind: 'managed_invitation_apply',
					input_hashes: { sourceHash: release.sourceHash, packageHash },
					expected_state: constructedPlan.targetPreconditions,
					status: 'partial',
					completed_steps: completedSteps,
					result: { planId: constructedPlan.planId },
					retry_of_operation_id: retryParentOperationId ?? null,
					sanitized_error: { message: 'managed_apply_failed_after_durable_mutation' },
				});
			if (partialReceiptError && partialReceiptError.code !== '23505') {
				console.error('Unable to record partial managed operation receipt.');
			}
			const detailedError = new Error(
				`[ERROR — ESTADO PARCIAL REANUDABLE] ${err instanceof Error ? err.message : String(err)}`,
				{ cause: err },
			);
			(detailedError as unknown as Record<string, unknown>).recoveryStatus =
				'ERROR — ESTADO PARCIAL REANUDABLE';
			(detailedError as unknown as Record<string, unknown>).completedSteps = completedSteps;
			throw detailedError;
		}
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
