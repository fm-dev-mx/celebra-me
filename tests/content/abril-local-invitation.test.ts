import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	buildAbrilPublishedContent,
	ABRIL_ASSET_SPECS,
	ABRIL_EVENT,
	type AbrilAssetMap,
} from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';

const abrilProfilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/abril-michelle-becerra-rea.scss',
);
const galleryContractPath = path.join(process.cwd(), 'docs/domains/theme/gallery-variants.md');

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

	it('loads the behavior-named paper itinerary with demo-parity tokens and Bodoni watermark', () => {
		const profile = fs.readFileSync(abrilProfilePath, 'utf8');
		expect(profile).toContain(
			"@use '../themes/sections/itinerary/timeline-paper' as itinerary-timeline-paper;",
		);
		expect(profile).toContain(
			"@use '@fontsource-variable/bodoni-moda/wght-italic.css' as bodoni-moda-italic;",
		);
		expect(profile).toContain(".itinerary[data-variant='timeline-paper']");
		expect(profile).toContain('--itinerary-paper-white: rgb(253 251 247);');
		// Paper and metal stay at demo parity, but the ink is deliberately re-tinted warm so
		// the reused celestial variant stops clashing with Abril's palette.
		expect(profile).toContain('--itinerary-ink-dark: var(--abril-dark-neutral);');
		expect(profile).toContain('--itinerary-slate: var(--abril-wine-dark);');
		expect(profile).toContain('--color-liquid-silver: rgb(200 208 212);');
		expect(profile).toContain("'Bodoni Moda Variable'");
		expect(profile).toContain('font-style: italic;');
		expect(profile).toContain('font-size: 3.5rem;');
		expect(profile).toContain('font-size: 4.75rem;');
		expect(profile).toContain('font-size: 6rem;');
		expect(profile).toContain('padding-top: 5.25rem;');
		expect(profile).toContain('--countdown-value-size-desktop: 4.5rem;');
		expect(profile).toContain('font-size: 5.25rem;');
		expect(profile).toContain(".itinerary:not([data-variant='timeline-paper'])");
	});

	it('keeps the Gallery composition exception explicit and documented', () => {
		const profile = fs.readFileSync(abrilProfilePath, 'utf8');
		const galleryContract = fs.readFileSync(galleryContractPath, 'utf8');

		expect(profile).toContain("[data-structural-variant='uniform-grid']");
		expect(profile).not.toContain("[data-variant='premiere-floral']");
		expect(galleryContract).toContain('unresolved invitation-specific extension');
		expect(galleryContract).toContain('Abril');
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
			envelope: {
				sealIcon: 'wax-monogram',
				sealInitials: 'A·M',
			},
			thankYou: { closingName: 'Abril Michelle', date: '12 de septiembre de 2026' },
		});
		expect(result.data!.itinerary?.presentation?.behavior).toBe('timeline-paper');
		expect(result.data!.sectionStyles?.itinerary).toBeUndefined();
		expect(result.data!.itinerary?.items).toEqual([
			expect.objectContaining({ label: 'Acción de gracias' }),
			expect.objectContaining({ label: 'Bienvenida' }),
			expect.objectContaining({ label: 'Cena de gala' }),
			expect.objectContaining({ label: 'Vals de honor' }),
			expect.objectContaining({ label: 'Cierre' }),
		]);
		expect(result.data!.itinerary?.items).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ label: 'Último baile' })]),
		);
		for (const item of result.data!.itinerary?.items ?? []) {
			expect(item.description?.trim()).toBeTruthy();
		}
		expect(result.data!.gifts?.items).toHaveLength(1);
		expect(result.data!.gifts?.items?.map((item) => item.type)).toEqual(['cash']);
		expect(result.data!.sectionOrder).toBeDefined();
		const sectionOrder = result.data!.sectionOrder!;
		expect(sectionOrder.indexOf('gifts')).toBe(sectionOrder.indexOf('gallery') + 1);
		expect(sectionOrder.indexOf('personalizedAccess')).toBe(sectionOrder.indexOf('gifts') + 1);
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
			gallery: {
				items: Array<{
					key?: string;
					layoutRole?: string;
					aspectRatio?: string;
					focalPoint?: string;
					focalPointMobile?: string;
					focalPointDesktop?: string;
				}>;
			};
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
			zoom: 16,
		});
		expect(typedContent.location.reception.coordinates).toEqual({
			lat: 21.3206241,
			lng: -101.9328009,
			zoom: 16,
		});

		const assets = buildTestAssets();
		expect(result.data!.gallery!.variant).toBe('uniform-grid');
		expect(result.data!.gallery!.items).toHaveLength(5);
		const galleryIds = result.data!.gallery!.items.map((item) =>
			typeof item.image === 'object' && item.image && 'assetId' in item.image
				? String(item.image.assetId)
				: '',
		);
		expect(galleryIds).toEqual([
			assets['gallery-01-candles'].assetId,
			assets['family-portrait'].assetId,
			assets['thank-you-confetti'].assetId,
			assets['gallery-03-seated-balloons'].assetId,
			assets['gallery-04-white-suit'].assetId,
		]);
		expect(new Set(galleryIds).size).toBe(5);
		const confettiItem = typedContent.gallery.items[2];
		expect(confettiItem).toMatchObject({
			key: 'thank-you-confetti',
			layoutRole: 'feature',
			aspectRatio: '8 / 5',
		});
		expect(JSON.stringify(typedContent.gallery.items)).not.toMatch(/100%\s*56%/);
		expect(confettiItem.focalPoint).not.toBe('100% 56%');
		expect(confettiItem.focalPointMobile).not.toBe('100% 56%');
		expect(confettiItem.focalPointDesktop).not.toBe('100% 56%');
		expect(result.data!.rsvp!.calendar).toEqual({
			title: 'XV de Abril Michelle',
			description:
				'Recepción de los XV años de Abril Michelle Becerra Rea. Garden Palace, Macedio Ayala núm. 70, Lagos de Moreno, Jalisco. Inicia a las 5:00 p. m.',
			startsAt: '2026-09-12T23:00:00.000Z',
		});
		expect(result.data!.rsvp!.responseMessages?.confirmed?.title).toContain('{guestName}');

		expect(result.data!.thankYou!.image).toEqual(assets['gallery-05-white-dress']);
		expect(result.data!.family!.featuredImage).toEqual(assets['gallery-02-bw-cake']);
		expect(assets['gallery-02-bw-cake'].assetId).not.toEqual(
			assets['gallery-05-white-dress'].assetId,
		);

		expect(content).toHaveProperty('music', {
			autoPlay: true,
			title: 'Talking to the moon',
			url: expect.stringMatching(/^https:\/\//),
		});
		expect(content).toHaveProperty('gifts');
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
				expect.objectContaining({ type: 'section', section: 'gifts' }),
			]),
		);
	});

	it('keeps the declaration free of provisioning implementation details', () => {
		expect(JSON.stringify(ABRIL_EVENT)).not.toMatch(/supabase|owner_user_id/i);
	});
});
