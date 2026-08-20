/**
 * Canonical promotional fingerprint for managed invitation status.
 * Equality evidence is live/canonical content + asset digests only.
 */
import { createHash } from 'node:crypto';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import {
	buildSemanticAssetMap,
	canonicalize,
	ASSET_KEY_PREFIX,
	loadSourceAssetDigests,
	semanticAssetRef,
	type SourceAssetDigest,
} from './normalized-invitation-release.ts';
import {
	areEquivalentAssetRepresentations,
	canonicalizeValue,
	hashManagedInvitationContent,
	isSemanticUploadedAssetRef,
	rewriteUploadedAssetReferences,
} from './promotion-comparison.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationDefinition,
	type InvitationDeliveryScope,
} from './invitations/invitation-definition.ts';
import type { EnvironmentPromotionState } from '../../src/lib/status/types.ts';

export { rewriteUploadedAssetReferences };
export type { EnvironmentPromotionState };

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export interface PromotionalAssetDigest {
	key: string;
	sha256: string;
}

export interface LiveAssetEvidence {
	id: string | null;
	managedSourceKey: string | null;
	managedSha256: string | null;
	sha256: string | null;
}

export interface LiveInvitationRow {
	slug: string;
	eventType: string | null;
	kind: string | null;
	baseDemoId: string | null;
	themeId: string | null;
	snapshot: unknown;
	managedIdentityId: string | null;
	definitionSlug: string | null;
	draftContent: unknown;
	publishedContent: unknown;
	assets: LiveAssetEvidence[];
}

export interface CanonicalFingerprintResult {
	ok: true;
	fingerprint: string;
	assetKeys: readonly string[];
	assetDigests: readonly PromotionalAssetDigest[];
	content: Record<string, unknown>;
}

export interface CanonicalFingerprintFailure {
	ok: false;
}

export type LiveFingerprintResult =
	| {
			ok: true;
			fingerprint: string;
			publishedDigest: string;
			draftDigest: string | null;
	  }
	| { ok: false };

function sha256Canonical(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assetDigest(managedSha256: string | null, sha256: string | null): string | null {
	if (managedSha256 && SHA256_HEX.test(managedSha256)) return managedSha256.toLowerCase();
	if (sha256 && SHA256_HEX.test(sha256)) return sha256.toLowerCase();
	return null;
}

export function computePromotionalFingerprint(input: {
	eventType: string;
	baseDemoId: string;
	themeId: string;
	kind: string;
	snapshot: unknown;
	content: Record<string, unknown>;
	assets: readonly PromotionalAssetDigest[];
}): string {
	const contentDigest = hashManagedInvitationContent(input.content);
	const assets = [...input.assets]
		.map((asset) => ({ key: asset.key, sha256: asset.sha256.toLowerCase() }))
		.sort((left, right) => left.key.localeCompare(right.key));
	return sha256Canonical({
		eventType: input.eventType,
		baseDemoId: input.baseDemoId,
		themeId: input.themeId,
		kind: input.kind,
		snapshot: canonicalizeValue(input.snapshot),
		contentDigest,
		assets,
	});
}

/**
 * Align content-only hosted asset slots to canonical semantic uploaded refs.
 * Only rewrites strings that sit where the canonical tree already has an uploaded
 * ref (so section names like `family` are not mistaken for asset keys).
 */
export function alignExternalAssetsToCanonical(live: unknown, canonical: unknown): unknown {
	if (isSemanticUploadedAssetRef(canonical)) {
		const key = canonical.assetId.slice(ASSET_KEY_PREFIX.length);
		if (typeof live === 'string' && areEquivalentAssetRepresentations(canonical, live)) {
			return semanticAssetRef(key);
		}
		return live;
	}
	if (Array.isArray(live) && Array.isArray(canonical)) {
		return live.map((item, index) => alignExternalAssetsToCanonical(item, canonical[index]));
	}
	if (isRecord(live) && isRecord(canonical)) {
		return Object.fromEntries(
			Object.entries(live).map(([key, child]) => [
				key,
				alignExternalAssetsToCanonical(child, canonical[key]),
			]),
		);
	}
	return live;
}

function rewriteLiveContentForFingerprint(
	content: unknown,
	keyByAssetId: ReadonlyMap<string, string>,
	canonicalContent: Record<string, unknown> | null,
	alignExternalRepresentation: boolean,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
	const uploaded = rewriteUploadedAssetReferences(content, keyByAssetId);
	if (!uploaded.ok) return { ok: false };
	const rewritten =
		alignExternalRepresentation && canonicalContent
			? alignExternalAssetsToCanonical(uploaded.value, canonicalContent)
			: uploaded.value;
	if (!isRecord(rewritten)) return { ok: false };
	return { ok: true, value: rewritten };
}

function collectLiveAssetEvidence(
	assets: readonly LiveAssetEvidence[],
	canonicalKeySet: ReadonlySet<string>,
):
	| {
			ok: true;
			keyByAssetId: Map<string, string>;
			liveAssetByKey: Map<string, PromotionalAssetDigest>;
	  }
	| { ok: false } {
	const keyByAssetId = new Map<string, string>();
	const liveAssetByKey = new Map<string, PromotionalAssetDigest>();
	for (const asset of assets) {
		const key = asset.managedSourceKey;
		if (!key) continue;
		if (asset.id) keyByAssetId.set(asset.id, key);
		if (!canonicalKeySet.has(key)) continue;
		const digest = assetDigest(asset.managedSha256, asset.sha256);
		if (!digest) return { ok: false };
		liveAssetByKey.set(key, { key, sha256: digest });
	}
	return { ok: true, keyByAssetId, liveAssetByKey };
}

function fillMissingContentOnlyDigests(
	liveAssetByKey: Map<string, PromotionalAssetDigest>,
	canonicalKeySet: ReadonlySet<string>,
	canonicalDigests: readonly PromotionalAssetDigest[],
): void {
	for (const digest of canonicalDigests) {
		if (!canonicalKeySet.has(digest.key) || liveAssetByKey.has(digest.key)) continue;
		liveAssetByKey.set(digest.key, {
			key: digest.key,
			sha256: digest.sha256.toLowerCase(),
		});
	}
}

function hasAllCanonicalAssetKeys(
	liveAssetByKey: ReadonlyMap<string, PromotionalAssetDigest>,
	canonicalAssetKeys: readonly string[],
): boolean {
	return canonicalAssetKeys.every((key) => liveAssetByKey.has(key));
}

function draftDigestForFingerprint(
	draftContent: unknown,
	keyByAssetId: ReadonlyMap<string, string>,
	canonicalContent: Record<string, unknown> | null,
	alignExternalRepresentation: boolean,
): { ok: true; digest: string | null } | { ok: false } {
	if (draftContent == null) return { ok: true, digest: null };
	if (!isRecord(draftContent)) return { ok: false };
	const draftRewrite = rewriteLiveContentForFingerprint(
		draftContent,
		keyByAssetId,
		canonicalContent,
		alignExternalRepresentation,
	);
	if (!draftRewrite.ok) return { ok: false };
	return { ok: true, digest: hashManagedInvitationContent(draftRewrite.value) };
}

export function buildLivePromotionalFingerprint(
	row: LiveInvitationRow,
	canonicalAssetKeys: readonly string[],
	options?: {
		deliveryScope?: InvitationDeliveryScope;
		canonicalAssetDigests?: readonly PromotionalAssetDigest[];
		canonicalContent?: Record<string, unknown>;
	},
): LiveFingerprintResult {
	if (!isRecord(row.publishedContent)) return { ok: false };
	const canonicalKeySet = new Set(canonicalAssetKeys);
	const collected = collectLiveAssetEvidence(row.assets, canonicalKeySet);
	if (!collected.ok) return { ok: false };
	const { keyByAssetId, liveAssetByKey } = collected;

	const inventoryIncomplete = !hasAllCanonicalAssetKeys(liveAssetByKey, canonicalAssetKeys);
	const useExternalKeyRepresentation = Boolean(
		options?.deliveryScope === 'content-only' &&
		inventoryIncomplete &&
		options.canonicalAssetDigests &&
		options.canonicalContent,
	);
	if (useExternalKeyRepresentation) {
		fillMissingContentOnlyDigests(
			liveAssetByKey,
			canonicalKeySet,
			options!.canonicalAssetDigests!,
		);
	}
	if (!hasAllCanonicalAssetKeys(liveAssetByKey, canonicalAssetKeys)) return { ok: false };

	const publishedRewrite = rewriteLiveContentForFingerprint(
		row.publishedContent,
		keyByAssetId,
		options?.canonicalContent ?? null,
		useExternalKeyRepresentation,
	);
	if (!publishedRewrite.ok) return { ok: false };
	const draft = draftDigestForFingerprint(
		row.draftContent,
		keyByAssetId,
		options?.canonicalContent ?? null,
		useExternalKeyRepresentation,
	);
	if (!draft.ok) return { ok: false };

	if (
		typeof row.eventType !== 'string' ||
		typeof row.baseDemoId !== 'string' ||
		typeof row.themeId !== 'string' ||
		typeof row.kind !== 'string'
	) {
		return { ok: false };
	}

	return {
		ok: true,
		fingerprint: computePromotionalFingerprint({
			eventType: row.eventType,
			baseDemoId: row.baseDemoId,
			themeId: row.themeId,
			kind: row.kind,
			snapshot: row.snapshot,
			content: publishedRewrite.value,
			assets: [...liveAssetByKey.values()],
		}),
		publishedDigest: hashManagedInvitationContent(publishedRewrite.value),
		draftDigest: draft.digest,
	};
}

export async function buildCanonicalPromotionalFingerprint(
	definition: InvitationDefinition,
	options?: {
		sourceDir?: string;
		assetDigests?: readonly SourceAssetDigest[];
	},
): Promise<CanonicalFingerprintResult | CanonicalFingerprintFailure> {
	try {
		const snapshot = findDemoPreset(definition.baseDemoId);
		if (!snapshot || snapshot.themeId !== definition.themeId) return { ok: false };
		const content = definition.buildPublishedContent(buildSemanticAssetMap(definition));
		if (!isRecord(content)) return { ok: false };
		const assetDigests =
			options?.assetDigests ??
			(await loadSourceAssetDigests(
				definition,
				options?.sourceDir ?? getInvitationAssetSourceDir(definition),
			));
		const expectedKeys = [...definition.assets.map((asset) => asset.key)].sort();
		const digestKeys = [...assetDigests.map((asset) => asset.key)].sort();
		if (expectedKeys.join('\0') !== digestKeys.join('\0')) return { ok: false };
		return {
			ok: true,
			fingerprint: computePromotionalFingerprint({
				eventType: definition.eventType,
				baseDemoId: definition.baseDemoId,
				themeId: definition.themeId,
				kind: 'client',
				snapshot,
				content,
				assets: assetDigests,
			}),
			assetKeys: expectedKeys,
			assetDigests: assetDigests.map((asset) => ({
				key: asset.key,
				sha256: asset.sha256.toLowerCase(),
			})),
			content,
		};
	} catch {
		return { ok: false };
	}
}

export function classifyLiveInvitation(input: {
	canonicalFingerprint: string;
	canonicalAssetKeys: readonly string[];
	expectedSlug: string;
	expectedManagedIdentityId: string;
	rows: readonly LiveInvitationRow[];
	deliveryScope?: InvitationDeliveryScope;
	canonicalAssetDigests?: readonly PromotionalAssetDigest[];
	canonicalContent?: Record<string, unknown>;
}): EnvironmentPromotionState {
	if (input.rows.length === 0) return 'absent';
	if (input.rows.length > 1) return 'conflict';
	const row = input.rows[0]!;
	if (row.definitionSlug && row.definitionSlug !== input.expectedSlug) return 'conflict';
	if (row.managedIdentityId && row.managedIdentityId !== input.expectedManagedIdentityId) {
		return 'conflict';
	}
	const live = buildLivePromotionalFingerprint(row, input.canonicalAssetKeys, {
		deliveryScope: input.deliveryScope,
		canonicalAssetDigests: input.canonicalAssetDigests,
		canonicalContent: input.canonicalContent,
	});
	if (!live.ok) return 'behind';
	const publishedMatches = live.fingerprint === input.canonicalFingerprint;
	const draftDiverged = live.draftDigest != null && live.draftDigest !== live.publishedDigest;
	if (publishedMatches && draftDiverged) return 'diverged';
	if (publishedMatches && row.managedIdentityId === input.expectedManagedIdentityId) {
		return 'match';
	}
	return 'behind';
}
