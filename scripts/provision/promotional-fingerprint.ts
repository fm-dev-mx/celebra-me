/**
 * Canonical promotional fingerprint for managed invitation status.
 * Equality evidence is live/canonical content + asset digests only.
 */
import { createHash } from 'node:crypto';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	ASSET_KEY_PREFIX,
	buildSemanticAssetMap,
	canonicalize,
	loadSourceAssetDigests,
	semanticAssetRef,
	type SourceAssetDigest,
} from './normalized-invitation-release.ts';
import { canonicalizeValue } from './promotion-comparison.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationDefinition,
} from './invitations/invitation-definition.ts';
import type { EnvironmentPromotionState } from '../../src/lib/status/types.ts';

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
	const contentDigest = hashPublicationProjection(input.content);
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

export function buildLivePromotionalFingerprint(
	row: LiveInvitationRow,
	canonicalAssetKeys: readonly string[],
): LiveFingerprintResult {
	if (!isRecord(row.publishedContent)) return { ok: false };
	const canonicalKeySet = new Set(canonicalAssetKeys);
	const keyByAssetId = new Map<string, string>();
	const liveAssetByKey = new Map<string, PromotionalAssetDigest>();
	for (const asset of row.assets) {
		const key = asset.managedSourceKey;
		if (!key) continue;
		if (asset.id) keyByAssetId.set(asset.id, key);
		if (!canonicalKeySet.has(key)) continue;
		const digest = assetDigest(asset.managedSha256, asset.sha256);
		if (!digest) return { ok: false };
		liveAssetByKey.set(key, { key, sha256: digest });
	}
	for (const key of canonicalAssetKeys) {
		if (!liveAssetByKey.has(key)) return { ok: false };
	}
	const liveAssets = [...liveAssetByKey.values()];

	const publishedRewrite = rewriteUploadedAssetReferences(row.publishedContent, keyByAssetId);
	if (!publishedRewrite.ok || !isRecord(publishedRewrite.value)) return { ok: false };
	const publishedDigest = hashPublicationProjection(publishedRewrite.value);

	let draftDigest: string | null = null;
	if (row.draftContent != null) {
		if (!isRecord(row.draftContent)) return { ok: false };
		const draftRewrite = rewriteUploadedAssetReferences(row.draftContent, keyByAssetId);
		if (!draftRewrite.ok || !isRecord(draftRewrite.value)) return { ok: false };
		draftDigest = hashPublicationProjection(draftRewrite.value);
	}

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
			assets: liveAssets,
		}),
		publishedDigest,
		draftDigest,
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
}): EnvironmentPromotionState {
	if (input.rows.length === 0) return 'absent';
	if (input.rows.length > 1) return 'conflict';
	const row = input.rows[0]!;
	if (row.definitionSlug && row.definitionSlug !== input.expectedSlug) return 'conflict';
	if (row.managedIdentityId && row.managedIdentityId !== input.expectedManagedIdentityId) {
		return 'conflict';
	}
	const live = buildLivePromotionalFingerprint(row, input.canonicalAssetKeys);
	if (!live.ok) return 'behind';
	const publishedMatches = live.fingerprint === input.canonicalFingerprint;
	const draftDiverged = live.draftDigest != null && live.draftDigest !== live.publishedDigest;
	if (publishedMatches && draftDiverged) return 'diverged';
	if (publishedMatches && row.managedIdentityId === input.expectedManagedIdentityId) {
		return 'match';
	}
	return 'behind';
}
