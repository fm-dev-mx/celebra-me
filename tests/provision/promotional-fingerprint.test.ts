/**
 * promotional-fingerprint.test.ts — Canonical/live fingerprint equality
 */
import { describe, expect, it } from '@jest/globals';
import { ASSET_KEY_PREFIX, semanticAssetRef } from '../../scripts/provision/normalized-invitation-release.ts';
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
		const rewritten = rewriteUploadedAssetReferences(liveContent(ASSET_UUID), new Map([[ASSET_UUID, 'hero']]));
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
		).toBe('unknown');
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

	it('classifies identity conflicts and missing hashes as blocked/unknown inputs', () => {
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
		).toBe('unknown');
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
});
