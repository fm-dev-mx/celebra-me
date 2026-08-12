import fs from 'node:fs';
import path from 'node:path';

import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { adaptEvent } from '@/lib/adapters/event';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	buildAlbaPublishedContent,
	ALBA_ASSET_SPECS,
	ALBA_EVENT,
	type AlbaAssetMap,
} from '../../scripts/provision/invitations/alba-rosa-quinonez.ts';
import {
	buildAbrilPublishedContent,
	ABRIL_ASSET_SPECS,
	type AbrilAssetMap,
} from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';
import {
	buildDanielaPublishedContent,
	DANIELA_ASSET_SPECS,
	type DanielaAssetMap,
} from '../../scripts/provision/invitations/daniela-y-martin.ts';
import {
	buildRominaPublishedContent,
	ROMINA_ASSET_SPECS,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';
import {
	buildVictoriaPublishedContent,
	VICTORIA_ASSET_SPECS,
	type VictoriaAssetMap,
} from '../../scripts/provision/invitations/victoria-y-roberto.ts';

/**
 * Consolidated content-level locks for managed invitations / fixtures.
 * Detailed payload suites remain authoritative; this file pins the canonical
 * structural/behavior contracts that must not regress after encapsulation.
 */

function loadCorpusFixture(slug: string) {
	const filePath = path.resolve(
		process.cwd(),
		`scripts/provision/local-render-corpus/fixtures/${slug}.json`,
	);
	return JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
		publishedContent?: Record<string, unknown>;
	};
}

function assetMapFromSpecs<T extends Record<string, unknown>>(
	specs: ReadonlyArray<{ key: string }>,
): T {
	return Object.fromEntries(
		specs.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as T;
}

describe('canonical corpus structural/behavior contracts', () => {
	it('locks Alba split-map Location, feature-stack Gallery, and days-only Countdown', () => {
		const content = buildAlbaPublishedContent(
			assetMapFromSpecs<AlbaAssetMap>(ALBA_ASSET_SPECS),
		);
		expect(content.location).toMatchObject({ variant: 'split-map' });
		expect(content.gallery).toMatchObject({ variant: 'feature-stack' });
		expect(content.countdown).toMatchObject({
			presentationOptions: { visibleUnits: ['days'] },
		});

		const viewModel = adaptDbEvent({
			slug: ALBA_EVENT.slug,
			eventType: ALBA_EVENT.eventType,
			isDemo: false,
			content,
			assetSlug: ALBA_EVENT.assetSlug,
		});
		expect(viewModel.sections.location?.structuralVariant).toBe('split-map');
		expect(viewModel.sections.gallery?.variant).toBe('feature-stack');
		expect(viewModel.sections.countdown?.visibleUnits).toEqual(['days']);
	});

	it('locks Romina Hero split-cover and itinerary standard', () => {
		const content = buildRominaPublishedContent(
			assetMapFromSpecs<RominaAssetMap>(ROMINA_ASSET_SPECS),
		);
		expect(content.hero).toMatchObject({ variant: 'split-cover' });
		expect(content.itinerary).toMatchObject({ variant: 'standard' });

		const viewModel = adaptEvent({
			id: 'events/romina-rios-chaparro',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.hero.structuralVariant).toBe('split-cover');
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('locks Victoria editorial-ledger, asymmetric-groups, stacked-venue-plates, and single-keepsake', () => {
		const content = buildVictoriaPublishedContent(
			assetMapFromSpecs<VictoriaAssetMap>(VICTORIA_ASSET_SPECS),
		);
		expect(content.itinerary).toMatchObject({ variant: 'editorial-ledger' });
		expect(content.family).toMatchObject({ variant: 'asymmetric-groups' });
		expect(content.location).toMatchObject({ variant: 'stacked-venue-plates' });
		expect(content.rsvp).toMatchObject({
			personalizedAccess: { variant: 'ornamented' },
		});
		expect(content.gallery).toMatchObject({ variant: 'single-keepsake' });

		const viewModel = adaptEvent({
			id: 'events/victoria-y-roberto',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.itinerary?.variant).toBe('editorial-ledger');
		expect(viewModel.sections.family?.structuralVariant).toBe('asymmetric-groups');
		expect(viewModel.sections.location?.structuralVariant).toBe('stacked-venue-plates');
		expect(viewModel.sections.rsvp?.personalizedAccess?.structuralVariant).toBe('ornamented');
		expect(viewModel.sections.gallery?.variant).toBe('single-keepsake');
	});

	it('locks Daniela Family split-groups, stacked-venue-plates, and gallery single-keepsake', () => {
		const content = buildDanielaPublishedContent(
			assetMapFromSpecs<DanielaAssetMap>(DANIELA_ASSET_SPECS),
		);
		expect(content.family).toMatchObject({ variant: 'split-groups' });
		expect(content.location).toMatchObject({ variant: 'stacked-venue-plates' });
		expect(content.gallery).toMatchObject({ variant: 'single-keepsake' });

		const viewModel = adaptEvent({
			id: 'events/daniela-y-martin',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.family?.structuralVariant).toBe('split-groups');
		expect(viewModel.sections.location?.structuralVariant).toBe('stacked-venue-plates');
		expect(viewModel.sections.gallery?.variant).toBe('single-keepsake');
	});

	it('locks Abril itinerary timeline-paper and gallery paired-feature-band', () => {
		const content = buildAbrilPublishedContent(
			assetMapFromSpecs<AbrilAssetMap>(ABRIL_ASSET_SPECS),
		);
		expect(content.itinerary).toMatchObject({ variant: 'timeline-paper' });
		expect(content.gallery).toMatchObject({ variant: 'paired-feature-band' });

		const viewModel = adaptEvent({
			id: 'events/abril-michelle-becerra-rea',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
		expect(viewModel.sections.gallery?.variant).toBe('paired-feature-band');
	});

	it('locks Luna revealSurface rsvp from the local-render corpus fixture', () => {
		const fixture = loadCorpusFixture('luna-y-estrella');
		const published = fixture.publishedContent ?? {};
		expect(published.location).toMatchObject({
			presentationOptions: { revealSurface: 'rsvp' },
		});
	});

	it('locks Leah explicit navigation from the local-render corpus fixture', () => {
		const fixture = loadCorpusFixture('leah-lexa');
		const published = fixture.publishedContent ?? {};
		expect(published.navigation).toEqual([
			{ label: 'Ubicación', href: '#event-location' },
			{ label: 'Fecha', href: '#inicio' },
			{ label: 'Regalos', href: '#regalos' },
			{ label: 'Confirmar', href: '#rsvp' },
		]);
		const result = eventContentSchema.safeParse({
			eventType: 'baby-shower',
			isDemo: false,
			title: 'Baby Shower de Leah Lexa',
			theme: { preset: 'celestial-blue' },
			hero: { name: 'Leah Lexa', date: '2026-06-21T20:00:00.000Z', backgroundImage: 'hero' },
			...published,
		});
		expect(result.success).toBe(true);
		expect(result.data?.navigation).toEqual(published.navigation);
	});

	it('locks Ana Sofía itinerary timeline-paper from the local-render corpus fixture', () => {
		const fixture = loadCorpusFixture('ana-sofia-cota-guillen');
		const published = fixture.publishedContent ?? {};
		expect(published.itinerary).toMatchObject({
			presentation: { behavior: 'timeline-paper' },
		});

		const viewModel = adaptEvent({
			id: 'events/ana-sofia-cota-guillen',
			data: {
				eventType: 'xv',
				isDemo: false,
				title: 'Ana Sofía',
				theme: { preset: 'celestial-blue' },
				hero: {
					name: 'Ana Sofía',
					date: '2026-05-23T00:00:00.000Z',
					backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				},
				...published,
			},
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
	});
});
