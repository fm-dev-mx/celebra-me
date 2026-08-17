import { existsSync } from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
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

	it('registers the in-progress celestial definition with a rhythm profile stylesheet', () => {
		const definition = getInvitationDefinition('leslie-perez');
		expect(definition.slug).toBe('leslie-perez');
		expect(definition.hostLoginAlias).toBe('leslie_perez');
		expect(definition.baseDemoId).toBe('demo-xv-celestial-blue');
		expect(definition.themeId).toBe('celestial-blue');
		expect(definition.visualProfileId).toBe('leslie-perez');
		expect(definition.lifecycle).toBe('in_progress');
		expect(
			existsSync(
				path.join(process.cwd(), 'src/styles/invitation-profiles/leslie-perez.scss'),
			),
		).toBe(true);
	});

	it('owns celestial-bookend cadence intersections and formal-register RSVP', () => {
		expect(content.rsvp).toMatchObject({ variant: 'formal-register' });
		expect(content.family).toMatchObject({
			labels: { sectionTitle: 'Mis padres' },
		});
		expect(content.composition).toEqual({
			intersections: {
				family: { family: 'atmospheric-blend', source: 'quote' },
				'interlude-after-location': { family: 'overlap', source: 'location' },
				itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
				'interlude-after-gallery': { family: 'overlap', source: 'gallery' },
				gifts: { family: 'atmospheric-blend', source: 'interlude-after-gallery' },
				'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
				thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
			},
		});
	});

	it('keeps unique photo roles across hero, gallery, interludes, and thank-you', () => {
		const gallery = content.gallery as { variant: string; items: Array<{ key: string }> };
		const interludes = content.interludes as Array<{ afterSection: string }>;
		const galleryKeys = gallery.items.map((item) => item.key);

		expect(gallery.variant).toBe('editorial-mosaic');
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
		expect(content.thankYou).toMatchObject({ variant: 'full-bleed-photo' });
		expect(content.thankYou).not.toHaveProperty('overlayAnchor');
		expect(content.thankYou).not.toHaveProperty('overlaySafeArea');
	});

	it('includes quote, gifts, and family groups without repeating guest thanks', () => {
		expect(content.quote).toMatchObject({
			author: 'Jeremías 29:11',
		});
		expect(String((content.quote as { text: string }).text)).toContain('planes');
		expect(String((content.quote as { text: string }).text)).not.toContain('PENDIENTE');
		expect(String((content.quote as { text: string }).text)).not.toContain(
			'Gracias por acompañarme',
		);
		expect(String((content.quote as { text: string }).text)).not.toContain(
			'Gracias por ser parte',
		);
		expect(content.family).toMatchObject({
			variant: 'asymmetric-groups',
			presentation: 'text-only',
			groups: [
				{ title: 'Madre', items: [{ name: 'Leticia Perez Moreno' }] },
				{ title: 'Padre', items: [{ name: 'Luis Enrique Zacarias Oviedo' }] },
			],
		});
		expect(content.gifts).toMatchObject({
			variant: 'standard',
			items: [{ type: 'cash' }],
		});
		expect(content).not.toHaveProperty('music');
		expect(content.sectionOrder).toEqual([
			'quote',
			'family',
			'countdown',
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

		expect(viewModel.hero.structuralVariant).toBe('split-cover');
		expect(viewModel.sections.family?.structuralVariant).toBe('asymmetric-groups');
		expect(viewModel.sections.location?.structuralVariant).toBe('split-map');
		expect(viewModel.sections.location?.showFlourishes).toBe(false);
		expect(viewModel.sections.gallery?.variant).toBe('editorial-mosaic');
		expect(viewModel.sections.gifts?.structuralVariant).toBe('standard');
		expect(viewModel.sections.rsvp?.structuralVariant).toBe('formal-register');
		expect(viewModel.sections.rsvp?.personalizedAccess.structuralVariant).toBe('formal-pass');
		expect(viewModel.music).toBeUndefined();
		expect(viewModel.interludes).toHaveLength(2);

		const plan = buildInvitationRenderPlan(viewModel, { isDemoPreview: true });
		const sequence = plan.map((item) =>
			item.type === 'section'
				? item.section
				: item.type === 'interlude'
					? `interlude-after-${item.afterSection}`
					: item.type,
		);

		expect(sequence).toEqual([
			'quote',
			'family',
			'countdown',
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
});
