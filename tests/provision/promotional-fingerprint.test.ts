/**
 * promotional-fingerprint.test.ts — Canonical/live fingerprint equality
 */
import { describe, expect, it } from '@jest/globals';
import {
	ASSET_KEY_PREFIX,
	semanticAssetRef,
} from '../../scripts/provision/normalized-invitation-release.ts';
import {
	buildLivePromotionalFingerprint,
	classifyLiveInvitation,
	computePromotionalFingerprint,
	rewriteUploadedAssetReferences,
	type LiveInvitationRow,
} from '../../scripts/provision/promotional-fingerprint.ts';

const HERO_SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const ASSET_UUID = '11111111-1111-4111-8111-111111111111';

function canonicalContent() {
	return {
		hero: semanticAssetRef('hero'),
		title: 'Celebración',
	};
}

function liveContent(assetId: string, title = 'Celebración') {
	return {
		hero: {
			type: 'uploaded',
			assetId,
			src: 'https://example.supabase.co/storage/v1/object/public/invitation-assets/hero.webp',
		},
		title,
	};
}

function fingerprintInput(overrides?: {
	title?: string;
	sha256?: string;
	eventType?: string;
	content?: Record<string, unknown>;
}) {
	return {
		eventType: overrides?.eventType ?? 'boda',
		baseDemoId: 'demo-boda-jewelry-box-wedding',
		themeId: 'jewelry-box-wedding',
		kind: 'client',
		snapshot: { themeId: 'jewelry-box-wedding' },
		content: overrides?.content ?? canonicalContent(),
		assets: [{ key: 'hero', sha256: overrides?.sha256 ?? HERO_SHA }],
	};
}

function liveRow(overrides?: Partial<LiveInvitationRow>): LiveInvitationRow {
	return {
		slug: 'demo-slug',
		eventType: 'boda',
		kind: 'client',
		baseDemoId: 'demo-boda-jewelry-box-wedding',
		themeId: 'jewelry-box-wedding',
		snapshot: { themeId: 'jewelry-box-wedding' },
		managedIdentityId: '00000000-0000-4000-8000-000000000001',
		definitionSlug: 'demo-slug',
		draftContent: liveContent(ASSET_UUID),
		publishedContent: liveContent(ASSET_UUID),
		assets: [
			{
				id: ASSET_UUID,
				managedSourceKey: 'hero',
				managedSha256: HERO_SHA,
				sha256: HERO_SHA,
			},
		],
		...overrides,
	};
}

describe('promotional fingerprint', () => {
	it('treats persisted asset UUIDs as equal to semantic keys after rewrite', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const rewritten = rewriteUploadedAssetReferences(
			liveContent(ASSET_UUID),
			new Map([[ASSET_UUID, 'hero']]),
		);
		expect(rewritten.ok).toBe(true);
		if (!rewritten.ok) return;
		const live = computePromotionalFingerprint(
			fingerprintInput({ content: rewritten.value as Record<string, unknown> }),
		);
		expect(live).toBe(canonical);
	});

	it('does not treat UUID differences as content changes when keys and hashes match', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const live = buildLivePromotionalFingerprint(liveRow(), ['hero']);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).toBe(canonical);
	});

	it('changes equality when an asset hash changes', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const live = buildLivePromotionalFingerprint(
			liveRow({
				assets: [
					{
						id: ASSET_UUID,
						managedSourceKey: 'hero',
						managedSha256: OTHER_SHA,
						sha256: OTHER_SHA,
					},
				],
			}),
			['hero'],
		);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).not.toBe(canonical);
	});

	it('does not use environment timestamps as equality evidence', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const match = classifyLiveInvitation({
			canonicalFingerprint: canonical,
			canonicalAssetKeys: ['hero'],
			expectedSlug: 'demo-slug',
			expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
			rows: [liveRow()],
		});
		expect(match).toBe('match');
		expect(Object.keys(liveRow())).not.toEqual(
			expect.arrayContaining(['draftUpdatedAt', 'publishedAt', 'updatedAt']),
		);
	});

	it('fails closed when an uploaded UUID cannot be mapped to a managed key', () => {
		const live = buildLivePromotionalFingerprint(
			liveRow({
				publishedContent: liveContent('22222222-2222-4222-8222-222222222222'),
			}),
			['hero'],
		);
		expect(live.ok).toBe(false);
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: computePromotionalFingerprint(fingerprintInput()),
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						publishedContent: liveContent('22222222-2222-4222-8222-222222222222'),
					}),
				],
			}),
		).toBe('behind');
	});

	it('detects draft divergence by digest regardless of timestamp ordering', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						draftContent: liveContent(ASSET_UUID, 'Borrador distinto'),
						publishedContent: liveContent(ASSET_UUID),
					}),
				],
			}),
		).toBe('diverged');
	});

	it('classifies identity conflicts as conflict and unverifiable unique rows as behind', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [liveRow(), liveRow({ managedIdentityId: 'other' })],
			}),
		).toBe('conflict');
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						assets: [
							{
								id: ASSET_UUID,
								managedSourceKey: 'hero',
								managedSha256: null,
								sha256: null,
							},
						],
					}),
				],
			}),
		).toBe('behind');
	});

	it('treats a missing managed identity as behind, not match or unknown', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [liveRow({ managedIdentityId: null })],
			}),
		).toBe('behind');
	});

	it('keeps already-semantic asset ids stable', () => {
		const rewritten = rewriteUploadedAssetReferences(
			{ hero: semanticAssetRef('hero') },
			new Map(),
		);
		expect(rewritten.ok).toBe(true);
		if (!rewritten.ok) return;
		const hero = (rewritten.value as { hero: { assetId: string } }).hero;
		expect(hero.assetId).toBe(`${ASSET_KEY_PREFIX}hero`);
	});

	it('matches content-only hosted key strings without live invitation_assets', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const canonicalContentTree = canonicalContent();
		const live = buildLivePromotionalFingerprint(
			liveRow({
				publishedContent: { hero: 'hero', title: 'Celebración' },
				draftContent: { hero: 'hero', title: 'Celebración' },
				assets: [],
			}),
			['hero'],
			{
				deliveryScope: 'content-only',
				canonicalAssetDigests: [{ key: 'hero', sha256: HERO_SHA }],
				canonicalContent: canonicalContentTree,
			},
		);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).toBe(canonical);
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				canonicalAssetDigests: [{ key: 'hero', sha256: HERO_SHA }],
				canonicalContent: canonicalContentTree,
				deliveryScope: 'content-only',
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						publishedContent: { hero: 'hero', title: 'Celebración' },
						draftContent: { hero: 'hero', title: 'Celebración' },
						assets: [],
					}),
				],
			}),
		).toBe('match');
	});

	it('still fails content-only when a hosted key string differs from canonical', () => {
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: computePromotionalFingerprint(fingerprintInput()),
				canonicalAssetKeys: ['hero'],
				canonicalAssetDigests: [{ key: 'hero', sha256: HERO_SHA }],
				canonicalContent: canonicalContent(),
				deliveryScope: 'content-only',
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						publishedContent: { hero: 'portrait', title: 'Celebración' },
						draftContent: { hero: 'portrait', title: 'Celebración' },
						assets: [],
					}),
				],
			}),
		).toBe('behind');
	});

	it('still fails content-only when a hosted URL identifies another asset key', () => {
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: computePromotionalFingerprint(fingerprintInput()),
				canonicalAssetKeys: ['hero'],
				canonicalAssetDigests: [{ key: 'hero', sha256: HERO_SHA }],
				canonicalContent: canonicalContent(),
				deliveryScope: 'content-only',
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						publishedContent: {
							hero: 'https://res.cloudinary.com/demo/image/upload/v1/portrait.webp',
							title: 'Celebración',
						},
						draftContent: {
							hero: 'https://res.cloudinary.com/demo/image/upload/v1/portrait.webp',
							title: 'Celebración',
						},
						assets: [],
					}),
				],
			}),
		).toBe('behind');
	});

	it('does not rewrite section-name strings that collide with asset keys', () => {
		const tree = {
			hero: semanticAssetRef('hero'),
			title: 'Celebración',
			sectionOrder: ['family', 'hero'],
		};
		const live = buildLivePromotionalFingerprint(
			liveRow({
				publishedContent: {
					hero: 'hero',
					title: 'Celebración',
					sectionOrder: ['family', 'hero'],
				},
				draftContent: {
					hero: 'hero',
					title: 'Celebración',
					sectionOrder: ['family', 'hero'],
				},
				assets: [],
			}),
			['hero', 'family'],
			{
				deliveryScope: 'content-only',
				canonicalAssetDigests: [
					{ key: 'hero', sha256: HERO_SHA },
					{ key: 'family', sha256: OTHER_SHA },
				],
				canonicalContent: tree,
			},
		);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).toBe(
			computePromotionalFingerprint({
				eventType: 'boda',
				baseDemoId: 'demo-boda-jewelry-box-wedding',
				themeId: 'jewelry-box-wedding',
				kind: 'client',
				snapshot: { themeId: 'jewelry-box-wedding' },
				content: tree,
				assets: [
					{ key: 'family', sha256: OTHER_SHA },
					{ key: 'hero', sha256: HERO_SHA },
				],
			}),
		);
	});

	it('ignores unreferenced zombie assets in DB when canonical assets match', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		const rowWithExtraZombieAssets = liveRow({
			assets: [
				{
					id: ASSET_UUID,
					managedSourceKey: 'hero',
					managedSha256: HERO_SHA,
					sha256: HERO_SHA,
				},
				{
					id: '99999999-9999-4999-8999-999999999999',
					managedSourceKey: 'obsolete-photo-02',
					managedSha256: OTHER_SHA,
					sha256: OTHER_SHA,
				},
			],
		});
		const live = buildLivePromotionalFingerprint(rowWithExtraZombieAssets, ['hero']);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).toBe(canonical);

		const match = classifyLiveInvitation({
			canonicalFingerprint: canonical,
			canonicalAssetKeys: ['hero'],
			expectedSlug: 'demo-slug',
			expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
			rows: [rowWithExtraZombieAssets],
		});
		expect(match).toBe('match');
	});

	it('does not treat host share-message overlays as fingerprint drift', () => {
		const canonical = computePromotionalFingerprint(
			fingerprintInput({
				content: {
					hero: semanticAssetRef('hero'),
					title: 'Celebración',
					sharing: { shareMessages: { invitation: 'Canónico' } },
				},
			}),
		);
		const live = buildLivePromotionalFingerprint(
			liveRow({
				publishedContent: {
					...liveContent(ASSET_UUID),
					sharing: { shareMessages: { invitation: 'Overlay de anfitrión' } },
				},
				draftContent: {
					...liveContent(ASSET_UUID),
					sharing: { shareMessages: { invitation: 'Overlay de anfitrión' } },
				},
			}),
			['hero'],
		);
		expect(live.ok).toBe(true);
		if (!live.ok) return;
		expect(live.fingerprint).toBe(canonical);
	});

	it('still fingerprints a material copy change as behind', () => {
		const canonical = computePromotionalFingerprint(fingerprintInput());
		expect(
			classifyLiveInvitation({
				canonicalFingerprint: canonical,
				canonicalAssetKeys: ['hero'],
				expectedSlug: 'demo-slug',
				expectedManagedIdentityId: '00000000-0000-4000-8000-000000000001',
				rows: [
					liveRow({
						publishedContent: liveContent(ASSET_UUID, 'Título distinto'),
						draftContent: liveContent(ASSET_UUID, 'Título distinto'),
					}),
				],
			}),
		).toBe('behind');
	});
});
