import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';

function buildTestAssets(): RominaAssetMap {
	return Object.fromEntries(
		ROMINA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as RominaAssetMap;
}

describe('Romina local invitation content', () => {
	it('uses an internally consistent Premiere Floral catalog entry', () => {
		const preset = findDemoPreset(ROMINA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-premiere-floral',
			eventType: 'xv',
			themeId: 'premiere-floral',
		});
		expect(
			checkPublishGuard({
				baseDemoId: ROMINA_EVENT.baseDemoId,
				themeId: ROMINA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('builds schema-valid published content without visible pending placeholders', () => {
		const content = buildRominaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		expect(JSON.stringify(content)).not.toMatch(/PENDING_|PROVISIONAL_/);
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
			thankYou: { closingName: 'Romina', date: '14 de agosto de 2026' },
		});
		const typedContent = content as {
			hero: { portrait?: unknown; backgroundImage?: unknown };
			location: {
				ceremony: { coordinates: unknown; googleMapsUrl: string; appleMapsUrl: string };
				reception: { coordinates: unknown; googleMapsUrl: string; appleMapsUrl: string };
			};
			rsvp: { subcopy: string };
		};
		expect(typedContent.hero.portrait).toBeUndefined();
		expect(typedContent.hero.backgroundImage).toBeDefined();
		expect(typedContent.location.ceremony.coordinates).toEqual({
			lat: expect.any(Number),
			lng: expect.any(Number),
		});
		expect(typedContent.location.reception.coordinates).toEqual({
			lat: expect.any(Number),
			lng: expect.any(Number),
		});
		expect(typedContent.location.reception.coordinates).not.toHaveProperty('zoom');
		expect(typedContent.location.ceremony.coordinates).not.toEqual(
			typedContent.location.reception.coordinates,
		);
		expect(result.data!.gallery!.items).toHaveLength(7);
		expect(content).toHaveProperty('music', {
			autoPlay: true,
			title: 'Perfect',
			url: expect.stringMatching(/^https:\/\//),
		});
		expect(content).not.toHaveProperty('gifts');
		const jsonString = JSON.stringify(content);
		expect(jsonString).not.toContain('contar with');
		expect(typedContent.rsvp.subcopy).toContain('contar con su presencia');
		expect(typedContent.rsvp.subcopy).not.toMatch(/15 de julio|deadline/i);
		expect(typedContent.location.ceremony.googleMapsUrl).toMatch(/^https:\/\//);
		expect(typedContent.location.ceremony.appleMapsUrl).toMatch(/^https:\/\//);
		expect(typedContent.location.reception.googleMapsUrl).toMatch(/^https:\/\//);
		expect(typedContent.location.reception.appleMapsUrl).toMatch(/^https:\/\//);
	});

	it('builds a public page context from uploaded images without an internal asset registry pack', () => {
		const content = buildRominaPublishedContent(buildTestAssets());
		const viewModel = adaptDbEvent({
			slug: ROMINA_EVENT.slug,
			eventType: ROMINA_EVENT.eventType,
			isDemo: false,
			content,
			assetSlug: ROMINA_EVENT.assetSlug,
		});
		const page = buildPageContextFromViewModel({
			viewModel,
			slug: ROMINA_EVENT.slug,
			eventType: ROMINA_EVENT.eventType,
		});

		expect(page.wrapper.className).toContain('event--romina-rios-chaparro');
		expect(page.layout.image).toContain('/invitation-assets/');
		expect(page.renderPlan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'section', section: 'gallery' }),
				expect.objectContaining({ type: 'interlude' }),
			]),
		);
	});

	it('keeps the declaration free of provisioning implementation details', () => {
		expect(JSON.stringify(ROMINA_EVENT)).not.toMatch(/supabase|owner_user_id/i);
	});
});
