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

describe('Single-File Invitation Definition Contract & Registry', () => {
	describe('defineInvitation helper', () => {
		it('returns a valid definition object when parameters pass', () => {
			const def = defineInvitation({
				slug: 'test-invitation',
				eventType: 'xv',
				title: 'Test Title',
				clientName: 'Client Name',
				baseDemoId: 'demo-xv-premiere-floral',
				themeId: 'premiere-floral',
				visualProfileId: 'test-invitation',
				eventTiming: {
					localDateTime: '2026-08-14T17:00',
					timeZone: 'America/Chihuahua',
					startsAtUtc: '2026-08-14T23:00:00.000Z',
				},
				assetSpecs: [{ key: 'hero', fileName: 'hero.jpg', displayName: 'Hero', alt: 'Alt' }],
				buildPublishedContent: () => ({ hero: { name: 'Test' } }),
			});

			expect(def.slug).toBe('test-invitation');
			expect(def.eventType).toBe('xv');
			expect(def.assetSpecs).toHaveLength(1);
		});

		it('throws on missing slug', () => {
			expect(() =>
				defineInvitation({
					slug: '',
					eventType: 'xv',
					title: 'Title',
					clientName: 'Client',
					baseDemoId: 'demo',
					themeId: 'theme',
					visualProfileId: 'profile',
					eventTiming: { localDateTime: '', timeZone: '', startsAtUtc: '' },
					assetSpecs: [],
					buildPublishedContent: () => ({}),
				}),
			).toThrow(/non-empty string slug/);
		});
	});

	describe('Registry', () => {
		it('registers and resolves Romina invitation by slug', () => {
			const resolved = getInvitationDefinition('romina-rios-chaparro');
			expect(resolved).toBe(rominaInvitation);
			expect(resolved.slug).toBe('romina-rios-chaparro');
			expect(resolved.eventType).toBe('xv');
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
	});

	describe('Romina single-file definition parity', () => {
		it('exports expected event metadata and asset specifications', () => {
			expect(rominaInvitation.slug).toBe(ROMINA_EVENT.slug);
			expect(rominaInvitation.eventType).toBe(ROMINA_EVENT.eventType);
			expect(rominaInvitation.title).toBe(ROMINA_EVENT.title);
			expect(rominaInvitation.assetSpecs).toHaveLength(11);
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
		});
	});
});
