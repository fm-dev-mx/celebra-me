import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	ROMINA_EVENT,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import { buildTestAssets } from '../helpers/managed-payload';

describe('Romina local invitation content', () => {
	it('uses an internally consistent Premiere Floral theme', () => {
		expect(resolveInvitationTheme({ themeId: ROMINA_EVENT.themeId })).toBe(
			ROMINA_EVENT.themeId,
		);
	});

	it('builds schema-valid published content without visible pending placeholders', () => {
		const content = buildRominaPublishedContent(buildTestAssets(ROMINA_ASSET_SPECS));
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
			hero: {
				portrait?: unknown;
				backgroundImage?: unknown;
				variant?: string;
			};
			location: {
				venues: Array<{
					type: string;
					coordinates: unknown;
					googleMapsUrl: string;
					appleMapsUrl: string;
				}>;
			};
			rsvp: { subcopy: string };
		};
		expect(typedContent.hero.portrait).toBeUndefined();
		expect(typedContent.hero.backgroundImage).toBeDefined();
		expect(typedContent.hero.variant).toBe('split-cover');
		const ceremony = typedContent.location.venues.find((venue) => venue.type === 'ceremony');
		const reception = typedContent.location.venues.find((venue) => venue.type === 'reception');
		expect(ceremony?.coordinates).toEqual({
			lat: expect.any(Number),
			lng: expect.any(Number),
		});
		expect(reception?.coordinates).toEqual({
			lat: expect.any(Number),
			lng: expect.any(Number),
		});
		expect(reception?.coordinates).not.toHaveProperty('zoom');
		expect(ceremony?.coordinates).not.toEqual(reception?.coordinates);
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
		expect(ceremony?.googleMapsUrl).toMatch(/^https:\/\//);
		expect(ceremony?.appleMapsUrl).toMatch(/^https:\/\//);
		expect(reception?.googleMapsUrl).toMatch(/^https:\/\//);
		expect(reception?.appleMapsUrl).toMatch(/^https:\/\//);
	});

	it('builds a public page context from uploaded images without an internal asset registry pack', () => {
		const content = buildRominaPublishedContent(buildTestAssets(ROMINA_ASSET_SPECS));
		const viewModel = adaptEvent({
			slug: ROMINA_EVENT.slug,
			content,
			assetSlug: ROMINA_EVENT.assetSlug,
		});
		const page = buildPageContextFromViewModel({
			viewModel,
			eventType: ROMINA_EVENT.eventType,
		});

		expect(page.wrapper.className).toContain('event--romina-rios-chaparro');
		expect(page.layout.image).toContain('/invitation-assets/');
		expect(page.viewModel.hero).toMatchObject({
			variant: 'split-cover',
		});
		expect(page.viewModel.sections.itinerary?.variant).toBe('standard');
		expect(content.itinerary).toMatchObject({ variant: 'standard' });
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
