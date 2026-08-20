/**
 * promotion-comparison.ts — Semantic comparison, normalization, and divergence
 * helpers extracted from invitation-import-engine.ts
 */
import type { InvitationPackageData } from './invitation-package.ts';
import { STORAGE_URL_PLACEHOLDER } from './invitation-package.ts';
import type { ResourcePlanAction } from './invitation-import-engine.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	canonicalizePublicationValue,
	preparePublicationProjection,
} from '../../src/lib/intake/services/publication-canonicalize.ts';
import { normalizeInvitationVariantInput } from '../../src/lib/invitation/variant-normalization.ts';
import { ASSET_KEY_PREFIX, semanticAssetRef } from './normalized-invitation-release.ts';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function canonicalizeValue(val: unknown, targetStorageUrl?: string): unknown {
	if (val === null || val === undefined) return null;
	if (typeof val === 'string') {
		let str = val;
		if (targetStorageUrl) str = str.replaceAll(targetStorageUrl, STORAGE_URL_PLACEHOLDER);
		return str.replaceAll(
			/https?:\/\/[a-zA-Z0-9_.-]+\/storage\/v1\/object\/public\/[a-zA-Z0-9_-]+/g,
			STORAGE_URL_PLACEHOLDER,
		);
	}
	if (typeof val === 'number' || typeof val === 'boolean') return val;
	if (Array.isArray(val)) return val.map((item) => canonicalizeValue(item, targetStorageUrl));
	if (typeof val === 'object') {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(val as Record<string, unknown>).sort()) {
			result[key] = canonicalizeValue(
				(val as Record<string, unknown>)[key],
				targetStorageUrl,
			);
		}
		return result;
	}
	return val;
}

export function isSemanticallyEqual(a: unknown, b: unknown, targetStorageUrl?: string): boolean {
	return (
		JSON.stringify(canonicalizeValue(a, targetStorageUrl)) ===
		JSON.stringify(canonicalizeValue(b, targetStorageUrl))
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Uploaded ref rewritten to a managed semantic key (src may already be stripped). */
export function isSemanticUploadedAssetRef(
	value: unknown,
): value is Record<string, unknown> & { type: 'uploaded'; assetId: string } {
	return (
		isRecord(value) &&
		value.type === 'uploaded' &&
		typeof value.assetId === 'string' &&
		value.assetId.startsWith(ASSET_KEY_PREFIX)
	);
}

/**
 * Hosted external asset URL string (Cloudinary, Storage host, or storage placeholder).
 */
export function isExternalHostedAssetString(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0) return false;
	if (value.includes(STORAGE_URL_PLACEHOLDER)) return true;
	return /^https?:\/\//i.test(value);
}

function externalHostedAssetKey(value: string): string | null {
	const path = value.split(/[?#]/, 1)[0] ?? value;
	const segment = path.split('/').filter(Boolean).at(-1);
	if (!segment) return null;
	const key = segment.replace(/\.[a-z0-9]+$/i, '');
	return /^[a-z0-9][a-z0-9_-]*$/i.test(key) ? key : null;
}

function semanticKeyFromUploadedRef(value: unknown): string | null {
	if (!isSemanticUploadedAssetRef(value)) return null;
	return value.assetId.slice(ASSET_KEY_PREFIX.length);
}

/**
 * True when managed uploaded refs and hosted content-only representations are the
 * same invitation-facing slot (NORMALIZATION_ARTIFACT):
 * - uploaded semantic key K ↔ plain string K
 * - uploaded semantic key ↔ hosted external URL string
 */
export function areEquivalentAssetRepresentations(left: unknown, right: unknown): boolean {
	const match = (uploaded: unknown, other: unknown): boolean => {
		const key = semanticKeyFromUploadedRef(uploaded);
		if (key == null || typeof other !== 'string' || other.length === 0) return false;
		if (other === key) return true;
		if (!isExternalHostedAssetString(other)) return false;
		// Opaque hosted URLs remain slot-owned; recognizable URL keys must agree.
		const hostedKey = externalHostedAssetKey(other);
		return hostedKey == null || hostedKey === key;
	};
	return match(left, right) || match(right, left);
}

function semanticCanonicalTreesEqual(left: unknown, right: unknown): boolean {
	if (areEquivalentAssetRepresentations(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
			return false;
		}
		return left.every((item, index) => semanticCanonicalTreesEqual(item, right[index]));
	}
	if (isRecord(left) || isRecord(right)) {
		if (!isRecord(left) || !isRecord(right)) return false;
		const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
		for (const key of keys) {
			if (!semanticCanonicalTreesEqual(left[key], right[key])) return false;
		}
		return true;
	}
	return left === right;
}

/**
 * Map environment-local uploaded asset UUIDs to managed semantic keys.
 * Already-semantic `__INVITATION_ASSET_KEY__:` ids stay stable.
 */
export function rewriteUploadedAssetReferences(
	value: unknown,
	keyByAssetId: ReadonlyMap<string, string>,
): { ok: true; value: unknown } | { ok: false } {
	const walk = (current: unknown): unknown => {
		if (Array.isArray(current)) return current.map(walk);
		if (!isRecord(current)) return current;
		if (current.type === 'uploaded' && typeof current.assetId === 'string') {
			const assetId = current.assetId;
			if (assetId.startsWith(ASSET_KEY_PREFIX)) {
				return semanticAssetRef(assetId.slice(ASSET_KEY_PREFIX.length));
			}
			const key = keyByAssetId.get(assetId);
			if (!key) throw new Error('UNMAPPED_UPLOADED_REF');
			return semanticAssetRef(key);
		}
		return Object.fromEntries(
			Object.entries(current).map(([key, child]) => [key, walk(child)]),
		);
	};
	try {
		return { ok: true, value: walk(value) };
	} catch {
		return { ok: false };
	}
}

function stripHostOwnedSharing(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stripHostOwnedSharing);
	if (!isRecord(value)) return value;
	const result: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key === 'sharing' && isRecord(child)) {
			const {
				shareMessages: _shareMessages,
				reminderSettings: _reminderSettings,
				...rest
			} = child;
			const strippedRest = stripHostOwnedSharing(rest);
			if (isRecord(strippedRest) && Object.keys(strippedRest).length > 0) {
				result.sharing = strippedRest;
			}
			continue;
		}
		result[key] = stripHostOwnedSharing(child);
	}
	return result;
}

function asContentRecord(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

/**
 * Single semantic invitation-content owner for cross-environment parity and
 * promotional fingerprints. Does not change publication optimistic-lock hashing.
 *
 * Pipeline: runtime variant fold → publication projection canonicalize →
 * host-owned sharing overlay strip → storage-host placeholder + key sort.
 * Callers that have environment asset UUIDs must rewrite them first via
 * `rewriteUploadedAssetReferences`.
 */
export function canonicalizeManagedInvitationContent(value: unknown): unknown {
	if (value === null || value === undefined) return null;
	let folded: unknown;
	try {
		folded = normalizeInvitationVariantInput(value);
	} catch {
		folded = { __variantNormalizationConflict: true, value };
	}
	return canonicalizeValue(
		stripHostOwnedSharing(canonicalizePublicationValue(preparePublicationProjection(folded))),
	);
}

export function hashManagedInvitationContent(value: unknown): string {
	return hashPublicationProjection(asContentRecord(canonicalizeManagedInvitationContent(value)));
}

export function semanticInvitationContentEqual(
	left: unknown,
	right: unknown,
	leftKeyByAssetId: ReadonlyMap<string, string> = new Map(),
	rightKeyByAssetId: ReadonlyMap<string, string> = new Map(),
): boolean {
	const leftRewrite = rewriteUploadedAssetReferences(left, leftKeyByAssetId);
	const rightRewrite = rewriteUploadedAssetReferences(right, rightKeyByAssetId);
	if (!leftRewrite.ok || !rightRewrite.ok) return false;
	return semanticCanonicalTreesEqual(
		canonicalizeManagedInvitationContent(leftRewrite.value),
		canonicalizeManagedInvitationContent(rightRewrite.value),
	);
}

// ---------------------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------------------

export function checkInvitationMetadataIdentical(
	pkgInv: InvitationPackageData['invitation'],
	existingInv: Record<string, unknown> | null,
	targetStorageUrl: string,
): boolean {
	if (!existingInv) return false;
	const existingManagedIdentity =
		typeof existingInv.managed_identity_id === 'string'
			? existingInv.managed_identity_id
			: null;
	// Missing managed identity is drift: backfill even when content/metadata otherwise match.
	if (pkgInv.managedIdentityId && existingManagedIdentity !== pkgInv.managedIdentityId) {
		return false;
	}
	return (
		existingInv.event_type === pkgInv.eventType &&
		existingInv.base_demo_id === pkgInv.baseDemoId &&
		existingInv.theme_id === pkgInv.themeId &&
		existingInv.kind === pkgInv.kind &&
		isSemanticallyEqual(pkgInv.snapshot, existingInv.snapshot, targetStorageUrl)
	);
}

export function checkDraftContentIdentical(
	pkgDraftContent: Record<string, unknown>,
	existingDraft: Record<string, unknown> | null,
	targetStorageUrl: string,
): boolean {
	if (!existingDraft) return false;
	return isSemanticallyEqual(pkgDraftContent, existingDraft.content, targetStorageUrl);
}

export function checkPublishedContentIdentical(
	pkgPublishedContent: Record<string, unknown>,
	existingPub: Record<string, unknown> | null,
	targetStorageUrl: string,
	isInvMetadataIdentical: boolean,
): boolean {
	if (!existingPub || !isInvMetadataIdentical) return false;
	return isSemanticallyEqual(pkgPublishedContent, existingPub.content, targetStorageUrl);
}

export function checkEventAndMembershipIdentical(
	pkg: InvitationPackageData,
	ownerUserId: string,
	targetInvitationId: string,
	existingEvent: Record<string, unknown> | null,
	existingMember: Record<string, unknown> | null,
): boolean {
	if (!existingEvent || !existingMember) return false;
	return (
		existingEvent.owner_user_id === ownerUserId &&
		existingEvent.event_type === pkg.invitation.eventType &&
		existingEvent.invitation_project_id === targetInvitationId &&
		existingMember.user_id === ownerUserId &&
		existingMember.membership_role === 'owner'
	);
}

export const APPLIED_HOSTED_TARGET_IDENTITY_FAILURE =
	'Final target verification failed; managed-release provenance was not recorded.';

export interface AppliedHostedTargetIdentityInput {
	pkg: InvitationPackageData;
	ownerUserId: string;
	targetInvitationId: string;
	targetStorageUrl: string;
	expectedDraftContent: Record<string, unknown>;
	expectedPublishedContent: Record<string, unknown>;
	existingInv: Record<string, unknown> | null;
	existingDraft: Record<string, unknown> | null;
	existingPub: Record<string, unknown> | null;
	existingEvent: Record<string, unknown> | null;
	existingMember: Record<string, unknown> | null;
}

export interface AppliedHostedTargetIdentity {
	isInvMetadataIdentical: boolean;
	isDraftIdentical: boolean;
	isPubIdentical: boolean;
	isEventAndMemberIdentical: boolean;
}

/**
 * Hosted identity without merge-baseline revision tokens.
 * Compares invitation metadata, draft/published content, and event/membership
 * to expected rows. Must not consult `updated_at` vs `applied_draft_updated_at`;
 * those tokens belong to merge-baseline planning, not this comparison.
 */
export function evaluateAppliedHostedTargetIdentity(
	input: AppliedHostedTargetIdentityInput,
): AppliedHostedTargetIdentity {
	const isInvMetadataIdentical = checkInvitationMetadataIdentical(
		input.pkg.invitation,
		input.existingInv,
		input.targetStorageUrl,
	);
	return {
		isInvMetadataIdentical,
		isDraftIdentical: checkDraftContentIdentical(
			input.expectedDraftContent,
			input.existingDraft,
			input.targetStorageUrl,
		),
		isPubIdentical: checkPublishedContentIdentical(
			input.expectedPublishedContent,
			input.existingPub,
			input.targetStorageUrl,
			isInvMetadataIdentical,
		),
		isEventAndMemberIdentical: checkEventAndMembershipIdentical(
			input.pkg,
			input.ownerUserId,
			input.targetInvitationId,
			input.existingEvent,
			input.existingMember,
		),
	};
}

export function assertAppliedHostedTargetIdentity(input: AppliedHostedTargetIdentityInput): void {
	const identity = evaluateAppliedHostedTargetIdentity(input);
	if (
		!identity.isInvMetadataIdentical ||
		!identity.isDraftIdentical ||
		!identity.isPubIdentical ||
		!identity.isEventAndMemberIdentical
	) {
		throw new Error(APPLIED_HOSTED_TARGET_IDENTITY_FAILURE);
	}
}

// ---------------------------------------------------------------------------
// Storage URL rewriting
// ---------------------------------------------------------------------------

export function rewritePackageStorageUrls(val: unknown, targetStorageUrl: string): unknown {
	if (typeof val === 'string')
		return val.replaceAll(`${STORAGE_URL_PLACEHOLDER}/`, `${targetStorageUrl}/`);
	if (Array.isArray(val))
		return val.map((item) => rewritePackageStorageUrls(item, targetStorageUrl));
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
// Divergence
// ---------------------------------------------------------------------------

export const ACKNOWLEDGE_DISCARD_UNPUBLISHED_DRAFT_FLAG =
	'--acknowledge-discard-unpublished-draft' as const;

export const TARGET_DIVERGENCE_ACKNOWLEDGE_HINT =
	'Descarte el borrador inédito del destino y aplique el paquete con --acknowledge-discard-unpublished-draft.';

/** Block code emitted by the orchestrator when the target has an unpublished draft
 *  that diverges from both the package and the last published version.
 *  Callers should match this constant rather than parsing the error message. */
export const TARGET_DIVERGENCE_BLOCK_CODE = 'UNPUBLISHED_DRAFT_DIVERGENCE' as const;

export function isTargetDivergenceConflictMessage(message: string): boolean {
	return message.includes('Target divergence conflict for');
}

export function checkTargetDivergenceConflict(
	slug: string,
	proposedContent: Record<string, unknown>,
	existingDraft: Record<string, unknown> | null,
	existingPub: Record<string, unknown> | null,
	options?: {
		packageContentHash?: string;
		acknowledgeDiscardUnpublishedDraft?: boolean;
	},
): void {
	if (!existingDraft) return;
	if ((existingDraft.status as string) !== 'draft') return;

	const proposedHash = hashPublicationProjection(proposedContent);
	const packageHash = options?.packageContentHash ?? proposedHash;
	const targetDraftHash = hashPublicationProjection(
		(existingDraft.content as Record<string, unknown>) ?? {},
	);
	const targetPubHash = existingPub
		? hashPublicationProjection((existingPub.content as Record<string, unknown>) ?? {})
		: null;

	if (targetDraftHash !== proposedHash && targetDraftHash !== targetPubHash) {
		if (options?.acknowledgeDiscardUnpublishedDraft) return;
		const publishedVersion =
			existingPub && existingPub.version !== undefined && existingPub.version !== null
				? String(existingPub.version)
				: 'none';
		throw new Error(
			`Target divergence conflict for "${slug}": target draft revision ${String(existingDraft.updated_at ?? existingDraft.id ?? 'unknown')}; target published version ${publishedVersion}; package content hash ${packageHash}; proposed merged-content hash ${proposedHash}; target draft hash ${targetDraftHash}; target published hash ${targetPubHash ?? 'none'}. ${TARGET_DIVERGENCE_ACKNOWLEDGE_HINT}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Resource plan construction
// ---------------------------------------------------------------------------

export function buildResourceActions(params: {
	slug: string;
	route: string;
	targetInvitationId: string;
	existingInv: Record<string, unknown> | null;
	isInvMetadataIdentical: boolean;
	assetActions: ResourcePlanAction[];
	existingDraft: Record<string, unknown> | null;
	isDraftIdentical: boolean;
	existingPub: Record<string, unknown> | null;
	isPubIdentical: boolean;
	existingEvent: Record<string, unknown> | null;
	isEventAndMemberIdentical: boolean;
}): ResourcePlanAction[] {
	return [
		{
			resource: 'invitation',
			name: params.slug,
			action: !params.existingInv
				? 'create'
				: !params.isInvMetadataIdentical
					? 'replace'
					: 'reuse',
			detail: !params.existingInv
				? `Create new invitation ID ${params.targetInvitationId}`
				: !params.isInvMetadataIdentical
					? `Update invitation metadata for ID ${params.targetInvitationId}`
					: `Invitation metadata up-to-date (ID ${params.targetInvitationId})`,
		},
		...params.assetActions,
		{
			resource: 'invitation_content_drafts',
			name: `${params.slug}-draft`,
			action: !params.existingDraft
				? 'create'
				: !params.isDraftIdentical
					? 'replace'
					: 'reuse',
			detail: !params.existingDraft
				? 'Create content draft'
				: !params.isDraftIdentical
					? 'Update content draft'
					: 'Content draft up-to-date',
		},
		{
			resource: 'published_invitation_content',
			name: params.route,
			action: !params.existingPub ? 'create' : !params.isPubIdentical ? 'replace' : 'reuse',
			detail: !params.existingPub
				? 'Publish initial version 1'
				: !params.isPubIdentical
					? `Publish (version ${(params.existingPub.version as number) + 1})`
					: `Published content up-to-date (version ${params.existingPub.version})`,
		},
		{
			resource: 'events',
			name: `${params.slug}-event`,
			action: !params.isEventAndMemberIdentical
				? !params.existingEvent
					? 'create'
					: 'replace'
				: 'reuse',
			detail: !params.isEventAndMemberIdentical
				? 'Upsert event and owner membership'
				: 'Event and membership up-to-date',
		},
	];
}
