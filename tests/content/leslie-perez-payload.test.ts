import { existsSync } from 'node:fs';
import path from 'node:path';

import { isDevEnvironment } from '@/lib/environment';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	LESLIE_ASSET_SPECS,
	LESLIE_EVENT,
	buildLesliePublishedContent,
	type LeslieAssetMap,
} from '../../scripts/provision/invitations/leslie-perez.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

function buildTestAssets(): LeslieAssetMap {
	return Object.fromEntries(
		LESLIE_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as LeslieAssetMap;
}

describe('Leslie Perez provision contract', () => {
	const content = buildLesliePublishedContent(buildTestAssets());

	it('registers the published celestial definition with a rhythm profile stylesheet', () => {
		const definition = getInvitationDefinition('leslie-perez');
		expect(definition.slug).toBe('leslie-perez');
		expect(definition.hostLoginAlias).toBe('leslie_perez');
		expect(definition.baseDemoId).toBe('demo-xv-celestial-blue');
		expect(definition.themeId).toBe('celestial-blue');
		expect(definition.visualProfileId).toBe('leslie-perez');
		expect(definition.lifecycle).toBe('published');
		expect(
			existsSync(
				path.join(process.cwd(), 'src/styles/invitation-profiles/leslie-perez.scss'),
			),
		).toBe(true);
	});

	it('owns celestial-bookend cadence intersections and formal-register RSVP', () => {
		expect(content.rsvp).toMatchObject({ variant: 'formal-register' });
		expect(content.family).toMatchObject({
			labels: {
				sectionTitle: 'Con la guía y el amor de mis padres',
				parentsTitle: 'Con su bendición',
			},
		});
		expect(content.composition).toEqual({
			intersections: {
				family: { family: 'overlap', source: 'hero' },
				countdown: { family: 'overlap', source: 'family' },
				'interlude-after-location': { family: 'overlap', source: 'location' },
				itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
				'interlude-after-gallery': { family: 'overlap', source: 'gallery' },
				gifts: { family: 'atmospheric-blend', source: 'interlude-after-gallery' },
				'personalized-access': { family: 'overlap', source: 'gifts' },
				thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
			},
		});
	});

	it('keeps the finalized itinerary, RSVP deadline, and reserved-color copy aligned', () => {
		const itinerary = content.itinerary as {
			items: Array<{ label: string; time: string }>;
		};

		expect(itinerary.items.map(({ label, time }) => ({ label, time }))).toEqual([
			{ label: 'Recepción', time: '19:00' },
			{ label: 'Presentación de la quinceañera', time: '20:00' },
			{ label: 'Cena', time: '21:30' },
			{ label: 'Cierre', time: '01:00' },
		]);
		expect(content.location).toMatchObject({
			indications: [
				expect.anything(),
				expect.objectContaining({
					text: 'El color azul marino está reservado exclusivamente para la quinceañera.',
				}),
			],
		});
		expect((content.rsvp as { subcopy: string }).subcopy).toBe(
			'Agradeceremos confirmar su asistencia antes del 15 de septiembre.',
		);
	});

	it('keeps unique photo roles across hero, gallery, interludes, and thank-you', () => {
		const gallery = content.gallery as { variant: string; items: Array<{ key: string }> };
		const interludes = content.interludes as Array<{ afterSection: string }>;
		const galleryKeys = gallery.items.map((item) => item.key);

		expect(gallery.variant).toBe('index-choreography');
		expect(galleryKeys).toEqual([
			'photo-02',
			'photo-03',
			'photo-05',
			'photo-06',
			'photo-07',
			'photo-09',
			'photo-10',
			'photo-11',
			'photo-12',
			'photo-13',
			'photo-14',
		]);
		expect(galleryKeys).not.toContain('photo-04');
		expect(galleryKeys).not.toContain('photo-08');
		expect(interludes).toEqual([
			expect.objectContaining({ afterSection: 'location' }),
			expect.objectContaining({ afterSection: 'gallery' }),
		]);
		expect(content.hero).toMatchObject({ variant: 'split-cover' });
		expect(
			(content.hero as { backgroundImage: { assetId: string } }).backgroundImage.assetId,
		).not.toBe(
			(content.hero as { backgroundImageMobile: { assetId: string } }).backgroundImageMobile
				.assetId,
		);
		expect(content.thankYou).toMatchObject({ variant: 'full-bleed-photo' });
		expect(content.thankYou).not.toHaveProperty('overlayAnchor');
		expect(content.thankYou).not.toHaveProperty('overlaySafeArea');
	});

	it('includes quote, gifts, and family groups without repeating guest thanks', () => {
		expect(content.quote).toMatchObject({
			author: 'Leslie',
		});
		expect(String((content.quote as { text: string }).text)).toContain('regalo de la vida');
		expect(String((content.quote as { text: string }).text)).not.toContain('PENDIENTE');
		expect(String((content.quote as { text: string }).text)).not.toContain(
			'Gracias por acompañarme',
		);
		expect(String((content.quote as { text: string }).text)).not.toContain(
			'Gracias por ser parte',
		);
		expect(content.family).toMatchObject({
			variant: 'standard',
			presentation: 'text-only',
			parents: {
				father: 'Luis Enrique Zacarias Oviedo',
				mother: 'Leticia Perez Moreno',
			},
		});
		expect(content.gifts).toMatchObject({
			variant: 'standard',
			items: [{ type: 'cash' }],
		});
		expect(content.music).toEqual({
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1787101349/Taylor_Swift_-_Fifteen_opt_n5gqpq.mp3',
			autoPlay: true,
		});
		expect(content.sectionOrder).toEqual([
			'family',
			'countdown',
			'quote',
			'location',
			'itinerary',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(content.location).not.toHaveProperty('presentationOptions');
	});

	it('parses as canonical event content and renders the closed section sequence', () => {
		const parsed = eventContentSchema.safeParse(content);
		if (!parsed.success) {
			console.error(parsed.error.issues);
		}
		expect(parsed.success).toBe(true);

		const viewModel = adaptEvent({
			id: `events/${LESLIE_EVENT.slug}`,
			data: content,
		} as Parameters<typeof adaptEvent>[0]);

		expect(viewModel.hero.variant).toBe('split-cover');
		expect(viewModel.sections.family?.variant).toBe('standard');
		expect(viewModel.sections.location?.variant).toBe('split-map');
		expect(viewModel.sections.location?.showFlourishes).toBe(false);
		expect(viewModel.sections.gallery?.variant).toBe('index-choreography');
		expect(viewModel.sections.gifts?.variant).toBe('standard');
		expect(viewModel.sections.rsvp?.variant).toBe('formal-register');
		expect(viewModel.sections.rsvp?.personalizedAccess.variant).toBe('formal-pass');
		expect(viewModel.music).toEqual({
			url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1787101349/Taylor_Swift_-_Fifteen_opt_n5gqpq.mp3',
			autoPlay: true,
			revealMode: 'envelope',
			title: undefined,
		});
		expect(viewModel.interludes).toHaveLength(2);

		const plan = buildInvitationRenderPlan(viewModel);
		const sequence = plan.map((item) =>
			item.type === 'section'
				? item.section
				: item.type === 'interlude'
					? `interlude-after-${item.afterSection}`
					: item.type,
		);

		expect(sequence).toEqual([
			'family',
			'countdown',
			'quote',
			'location',
			'interlude-after-location',
			'itinerary',
			'gallery',
			'interlude-after-gallery',
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
	});

	it('assembles the music player on hosted Production from published music', () => {
		const viewModel = adaptEvent({
			id: `events/${LESLIE_EVENT.slug}`,
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		const isDev = isDevEnvironment as jest.MockedFunction<typeof isDevEnvironment>;
		const originalVercel = process.env.VERCEL;
		const originalVercelEnv = process.env.VERCEL_ENV;

		isDev.mockReturnValue(true);
		process.env.VERCEL = '1';
		process.env.VERCEL_ENV = 'production';

		try {
			const page = buildPageContextFromViewModel({
				viewModel,
				slug: LESLIE_EVENT.slug,
				eventType: LESLIE_EVENT.eventType,
			});
			expect(viewModel.music).toEqual({
				url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1787101349/Taylor_Swift_-_Fifteen_opt_n5gqpq.mp3',
				autoPlay: true,
				revealMode: 'envelope',
				title: undefined,
			});
			expect(page.musicPlayer).toEqual({
				url: 'https://res.cloudinary.com/dusxvauvj/video/upload/v1787101349/Taylor_Swift_-_Fifteen_opt_n5gqpq.mp3',
				autoPlay: true,
				title: undefined,
				revealMode: 'envelope',
				variant: 'standard',
			});
		} finally {
			isDev.mockReturnValue(false);
			if (originalVercel === undefined) {
				delete process.env.VERCEL;
			} else {
				process.env.VERCEL = originalVercel;
			}
			if (originalVercelEnv === undefined) {
				delete process.env.VERCEL_ENV;
			} else {
				process.env.VERCEL_ENV = originalVercelEnv;
			}
		}
	});

	it('does not assemble a music player on hosted Production when no music is published', () => {
		const unpublished = { ...content, music: undefined };
		const viewModel = adaptEvent({
			id: `events/${LESLIE_EVENT.slug}`,
			data: unpublished,
		} as Parameters<typeof adaptEvent>[0]);
		const isDev = isDevEnvironment as jest.MockedFunction<typeof isDevEnvironment>;
		const originalVercel = process.env.VERCEL;
		const originalVercelEnv = process.env.VERCEL_ENV;

		isDev.mockReturnValue(true);
		process.env.VERCEL = '1';
		process.env.VERCEL_ENV = 'production';

		try {
			const page = buildPageContextFromViewModel({
				viewModel,
				slug: LESLIE_EVENT.slug,
				eventType: LESLIE_EVENT.eventType,
			});
			expect(viewModel.music).toBeUndefined();
			expect(page.musicPlayer).toBeUndefined();
		} finally {
			isDev.mockReturnValue(false);
			if (originalVercel === undefined) {
				delete process.env.VERCEL;
			} else {
				process.env.VERCEL = originalVercel;
			}
			if (originalVercelEnv === undefined) {
				delete process.env.VERCEL_ENV;
			} else {
				process.env.VERCEL_ENV = originalVercelEnv;
			}
		}
	});
});
