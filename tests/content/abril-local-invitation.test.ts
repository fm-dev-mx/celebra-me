import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	buildAbrilPublishedContent,
	ABRIL_ASSET_SPECS,
	ABRIL_EVENT,
	type AbrilAssetMap,
} from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';

function buildTestAssets(): AbrilAssetMap {
	return Object.fromEntries(
		ABRIL_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as AbrilAssetMap;
}

describe('Abril Michelle local invitation content', () => {
	it('uses an internally consistent Premiere Floral catalog entry', () => {
		const preset = findDemoPreset(ABRIL_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-xv-premiere-floral',
			eventType: 'xv',
			themeId: 'premiere-floral',
		});
		expect(
			checkPublishGuard({
				baseDemoId: ABRIL_EVENT.baseDemoId,
				themeId: ABRIL_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('builds schema-valid published content without visible pending placeholders', () => {
		const content = buildAbrilPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		expect(JSON.stringify(content)).not.toMatch(/PENDING_|PROVISIONAL_/);
		expect(content).toMatchObject({
			eventType: 'xv',
			visualProfileId: 'abril-michelle-becerra-rea',
			_assetSlug: 'abril-michelle-becerra-rea',
			theme: { preset: 'premiere-floral' },
			eventTiming: {
				localDateTime: '2026-09-12T15:00',
				timeZone: 'America/Mexico_City',
				startsAtUtc: '2026-09-12T21:00:00.000Z',
			},
			rsvp: { accessMode: 'personalized-only' },
			envelope: { sealInitials: 'AM' },
			thankYou: { closingName: 'Abril Michelle', date: '12 de septiembre de 2026' },
		});
		const typedContent = content as {
			hero: { portrait?: unknown; backgroundImage?: unknown };
			location: {
				ceremony: {
					coordinates: unknown;
					googleMapsUrl: string;
					appleMapsUrl: string;
					venueName: string;
					address: string;
				};
				reception: {
					coordinates: unknown;
					googleMapsUrl: string;
					appleMapsUrl: string;
					venueName: string;
					address: string;
				};
			};
			family: {
				parents: { mother: string; father: string };
				godparents: Array<{ name: string }>;
			};
			rsvp: { subcopy: string };
		};

		expect(typedContent.hero.portrait).toBeUndefined();
		expect(typedContent.hero.backgroundImage).toBeDefined();
		expect(typedContent.family.parents.mother).toBe('Sandy Guadalupe Rea Mendoza');
		expect(typedContent.family.parents.father).toBe('José Luis Becerra Ornelas');
		expect(typedContent.family.godparents).toHaveLength(2);
		expect(typedContent.family.godparents[0].name).toBe('María del Carmen Becerra Ornelas');
		expect(typedContent.family.godparents[1].name).toBe('Ramiro Contreras Bermejo');

		expect(typedContent.location.ceremony.venueName).toBe(
			'Templo y Ex Convento de Nuestra Señora de la Merced',
		);
		expect(typedContent.location.reception.venueName).toBe('Garden Palace');
		expect(typedContent.location.reception.address).toContain('Macedio Ayala');

		expect(typedContent.location.ceremony.coordinates).toEqual({
			lat: 21.3542979,
			lng: -101.9320163,
		});
		expect(typedContent.location.reception.coordinates).toEqual({
			lat: 21.3206241,
			lng: -101.9328009,
			zoom: 14,
		});

		expect(result.data!.gallery!.items).toHaveLength(5);
		expect(content).not.toHaveProperty('music');
		expect(content).not.toHaveProperty('gifts');
		expect(typedContent.location.ceremony.googleMapsUrl).toMatch(/^https:\/\//);
		expect(typedContent.location.reception.googleMapsUrl).toMatch(/^https:\/\//);
	});

	it('builds a public page context from uploaded images without errors', () => {
		const content = buildAbrilPublishedContent(buildTestAssets());
		const viewModel = adaptDbEvent({
			slug: ABRIL_EVENT.slug,
			eventType: ABRIL_EVENT.eventType,
			isDemo: false,
			content,
			assetSlug: ABRIL_EVENT.assetSlug,
		});
		const page = buildPageContextFromViewModel({
			viewModel,
			slug: ABRIL_EVENT.slug,
			eventType: ABRIL_EVENT.eventType,
		});

		expect(page.wrapper.className).toContain('event--abril-michelle-becerra-rea');
		expect(page.layout.image).toContain('/invitation-assets/');
		expect(page.renderPlan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'section', section: 'gallery' }),
			]),
		);
	});

	it('keeps the declaration free of provisioning implementation details', () => {
		expect(JSON.stringify(ABRIL_EVENT)).not.toMatch(/supabase|owner_user_id/i);
	});
});
