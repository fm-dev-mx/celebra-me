/**
 * Unit & Contract tests for scripts/provision/invitations/
 *
 * Tests single-file invitation definition contract, helper, registry,
 * and Romina single-file projection parity against legacy data.
 */

import { describe, it, expect } from '@jest/globals';
import { defineInvitation } from '../../scripts/provision/invitations/invitation-definition.ts';
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from '../../scripts/provision/invitations/registry.ts';
import {
	rominaInvitation,
	buildRominaPublishedContent,
	ROMINA_EVENT,
	ROMINA_ASSET_SPECS,
	type RominaAssetKey,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import type { UploadedAssetMap } from '../../scripts/provision/invitations/invitation-definition.ts';

function buildMockAssets(): UploadedAssetMap<RominaAssetKey> {
	return Object.fromEntries(
		ROMINA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as UploadedAssetMap<RominaAssetKey>;
}

const TEST_MANAGED_IDENTITY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('Single-File Invitation Definition Contract & Registry', () => {
	describe('defineInvitation helper', () => {
		it('returns a valid definition object when parameters pass', () => {
			const def = defineInvitation({
				slug: 'test-invitation',
				managedIdentityId: TEST_MANAGED_IDENTITY_ID,
				createdAt: '2026-07-20T00:00:00.000Z',
				lifecycle: 'in_progress',
				deliveryScope: 'content-and-assets',
				eventType: 'xv',
				title: 'Test Title',
				clientName: 'Client Name',
				hostLoginAlias: 'client_name',
				baseDemoId: 'demo-xv-premiere-floral',
				themeId: 'premiere-floral',
				visualProfileId: 'test-invitation',
				eventTiming: {
					localDateTime: '2026-08-14T17:00',
					timeZone: 'America/Chihuahua',
					startsAtUtc: '2026-08-14T23:00:00.000Z',
				},
				assets: [
					{ key: 'hero', relativePath: 'hero.jpg', displayName: 'Hero', alt: 'Alt' },
				],
				buildPublishedContent: (assets) => ({
					eventType: 'xv',
					title: 'Test Title',
					theme: { preset: 'premiere-floral' },
					sectionOrder: ['rsvp'],
					composition: { intersections: {} },
					hero: {
						name: 'Test Title',
						date: '2026-08-14T23:00:00.000Z',
						backgroundImage: assets.hero,
						variant: 'standard',
					},
					rsvp: { variant: 'standard', personalizedAccess: { variant: 'standard' } },
				}),
			});

			expect(def.slug).toBe('test-invitation');
			expect(def.managedIdentityId).toBe(TEST_MANAGED_IDENTITY_ID);
			expect(def.hostLoginAlias).toBe('client_name');
			expect(def.eventType).toBe('xv');
			expect(def.assets).toHaveLength(1);
		});

		it('throws on missing slug', () => {
			expect(() =>
				defineInvitation({
					slug: '',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/non-empty string slug/);
		});

		it('throws when slug repeats eventType prefix', () => {
			expect(() =>
				defineInvitation({
					slug: 'boda-daniela-y-martin',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'boda',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'daniela_medina',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/must not include eventType/);
		});

		it('throws on invalid hostLoginAlias', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'Bad Alias!',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/hostLoginAlias/);
		});

		it('throws on non-v4 managedIdentityId', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee',
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/managedIdentityId/);
		});

		it('throws on non-UTC createdAt', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/createdAt/);
		});

		it('throws on invalid lifecycle', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'draft' as never,
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/lifecycle/);
		});

		it('throws when previousSlugs includes current slug or duplicates', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					previousSlugs: ['test-invitation'],
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/previousSlugs must not include the current slug/);
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					previousSlugs: ['old-slug', 'old-slug'],
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/duplicate/);
		});

		it('throws on absolute or traversal asset paths', () => {
			expect(() =>
				defineInvitation({
					slug: 'test-invitation',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client_name',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [
						{
							key: 'hero',
							relativePath: '../escape.jpg',
							displayName: 'Hero',
							alt: 'Alt',
						},
					],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/relative path/);
		});

		it('rejects environment-local asset references in content', () => {
			expect(() =>
				defineInvitation({
					slug: 'unsafe-reference',
					managedIdentityId: TEST_MANAGED_IDENTITY_ID,
					createdAt: '2026-07-20T00:00:00.000Z',
					lifecycle: 'in_progress',
					deliveryScope: 'content-and-assets',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					hostLoginAlias: 'client',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assets: [
						{ key: 'hero', relativePath: 'hero.jpg', displayName: 'Hero', alt: 'Alt' },
					],
					buildPublishedContent: () => ({
						hero: {
							type: 'uploaded',
							assetId: '00000000-0000-4000-8000-000000000001',
							src: 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/hero.webp',
						},
					}),
				}),
			).toThrow(/semantic key/i);
		});
	});

	describe('Registry', () => {
		it('registers and resolves Romina invitation by slug', () => {
			const resolved = getInvitationDefinition('romina-rios-chaparro');
			expect(resolved).toBe(rominaInvitation);
			expect(resolved.slug).toBe('romina-rios-chaparro');
			expect(resolved.hostLoginAlias).toBe('romina_rios_chaparro');
			expect(resolved.eventType).toBe('xv');
		});

		it('exposes short host login aliases for Abril and Alba', () => {
			expect(getInvitationDefinition('abril-michelle-becerra-rea').hostLoginAlias).toBe(
				'abril_becerra',
			);
			expect(getInvitationDefinition('alba-rosa-quinonez').hostLoginAlias).toBe(
				'alba_quinonez',
			);
		});

		it('lists all registered invitation definitions', () => {
			const list = listInvitationDefinitions();
			expect(list).toEqual(expect.arrayContaining([rominaInvitation]));
		});

		it('throws clean error for unregistered slug', () => {
			expect(() => getInvitationDefinition('unknown-slug')).toThrow(
				/Invitation definition with slug "unknown-slug" not found/i,
			);
		});

		it('future invitations keep unique managedIdentityId and hostLoginAlias', () => {
			const list = listInvitationDefinitions();
			const identities = list.map((d) => d.managedIdentityId);
			const aliases = list.map((d) => d.hostLoginAlias);
			expect(new Set(identities).size).toBe(identities.length);
			expect(new Set(aliases).size).toBe(aliases.length);
			for (const def of list) {
				expect(def.slug).not.toMatch(new RegExp(`^${def.eventType}-`));
				expect(def.managedIdentityId).toMatch(
					/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
				);
				expect(def.createdAt.endsWith('Z')).toBe(true);
				expect(['in_progress', 'published']).toContain(def.lifecycle);
				expect(['content-only', 'content-and-assets', 'assets-only']).toContain(
					def.deliveryScope,
				);
			}
		});
	});

	describe('Romina single-file definition parity', () => {
		it('exports expected event metadata and asset specifications', () => {
			expect(rominaInvitation.slug).toBe(ROMINA_EVENT.slug);
			expect(rominaInvitation.eventType).toBe(ROMINA_EVENT.eventType);
			expect(rominaInvitation.title).toBe(ROMINA_EVENT.title);
			expect(rominaInvitation.assets).toHaveLength(13);
		});

		it('builds published content matching expected projection structure', () => {
			const mockAssets = buildMockAssets();
			const content = rominaInvitation.buildPublishedContent(mockAssets);

			expect(content).toMatchObject({
				eventType: 'xv',
				visualProfileId: 'romina-rios-chaparro',
				_assetSlug: 'romina-rios-chaparro',
				theme: { preset: 'premiere-floral' },
				eventTiming: {
					localDateTime: '2026-08-14T17:00',
					timeZone: 'America/Chihuahua',
					startsAtUtc: '2026-08-14T23:00:00.000Z',
				},
				rsvp: { accessMode: 'personalized-only' },
				envelope: { sealInitials: 'RC' },
			});
			expect(buildRominaPublishedContent(mockAssets)).toEqual(content);
			expect(
				(content.hero as { backgroundImage: { assetId: string } }).backgroundImage.assetId,
			).not.toBe(
				(content.hero as { backgroundImageMobile: { assetId: string } })
					.backgroundImageMobile.assetId,
			);
		});
	});
});
