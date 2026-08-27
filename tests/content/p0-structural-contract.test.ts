import fs from 'node:fs';
import path from 'node:path';

import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { adaptEvent } from '@/lib/adapters/event';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
	resolveInvitationCssUrls,
} from '@/lib/invitation/section-css-resolver-map';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	ABRIL_ASSET_SPECS,
	buildAbrilPublishedContent,
	type AbrilAssetMap,
} from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';
import {
	ROMINA_ASSET_SPECS,
	buildRominaPublishedContent,
	type RominaAssetMap,
} from '../../scripts/provision/invitations/romina-rios-chaparro.ts';

/**
 * P0 lock: persisted celestial consumers must carry explicit canonical
 * contracts through schema → adapter → renderer branch → CSS entrypoints.
 * Omitted fields fail closed; a default is not an acceptable stand-in for
 * these invitations.
 */

function loadJson(relativePath: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')) as Record<
		string,
		unknown
	>;
}

function loadCorpusPublished(slug: string): Record<string, unknown> {
	const fixture = loadJson(`scripts/provision/local-render-corpus/fixtures/${slug}.json`);
	const published = fixture.publishedContent;
	if (!published || typeof published !== 'object' || Array.isArray(published)) {
		throw new Error(`Corpus fixture ${slug} is missing publishedContent`);
	}
	return published as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
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

function celestialEnvelope(published: Record<string, unknown>, slug: string) {
	return {
		eventType: 'xv',
		isDemo: false,
		title: slug,
		theme: { preset: 'celestial-blue' },
		sectionOrder: ['itinerary', 'gallery', 'thankYou'],
		composition: { intersections: {} },
		hero: {
			name: 'Celebrante',
			date: '2026-09-12T00:00:00.000Z',
			backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
			variant: 'standard',
		},
		...published,
	};
}

function resolveStructuralCss(input: {
	themePreset: string;
	itineraryVariant?: string;
	galleryVariant?: string;
}): string[] {
	const bundleUrlMap = buildSectionBundleUrlMap({
		'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
			default: '/_astro/celestial-bundle.css',
		},
		'/src/styles/invitation-sections-by-preset/premiere-floral.scss': {
			default: '/_astro/premiere-bundle.css',
		},
	});
	const sectionUrlMap = buildSectionUrlMap({
		'/src/styles/themes/sections/itinerary/_timeline-paper.scss': {
			default: '/_astro/itinerary-timeline-paper.css',
		},
		'/src/styles/themes/sections/gallery/_index-choreography.scss': {
			default: '/_astro/gallery-index-choreography.css',
		},
		'/src/styles/themes/sections/gallery/_paired-feature-band.scss': {
			default: '/_astro/gallery-paired-feature-band.css',
		},
		'/src/styles/themes/sections/gallery/_editorial-mosaic.scss': {
			default: '/_astro/gallery-editorial-mosaic.css',
		},
	});
	return resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
		themePreset: input.themePreset,
		sectionVariants: {
			itinerary: input.itineraryVariant,
			gallery: input.galleryVariant,
		},
	});
}

function assertCelestialProgramPath(source: Record<string, unknown>, slug: string) {
	const itinerary = asRecord(source.itinerary);
	const hasCanonicalVariant = itinerary?.variant === 'timeline-paper';
	expect(hasCanonicalVariant).toBe(true);
	expect(asRecord(source.gallery)?.variant).toBe('index-choreography');

	const parsed = eventContentSchema.safeParse(celestialEnvelope(source, slug));
	expect(parsed.success).toBe(true);
	if (!parsed.success) return;

	expect(parsed.data.itinerary?.variant).toBe('timeline-paper');
	expect(parsed.data.gallery?.variant).toBe('index-choreography');

	const viewModel = adaptDbEvent({
		slug,
		eventType: 'xv',
		isDemo: false,
		content: celestialEnvelope(source, slug),
	});
	expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
	expect(viewModel.sections.gallery?.variant).toBe('index-choreography');

	const cssUrls = resolveStructuralCss({
		themePreset: 'celestial-blue',
		itineraryVariant: viewModel.sections.itinerary?.variant,
		galleryVariant: viewModel.sections.gallery?.variant,
	});
	expect(cssUrls).toEqual(
		expect.arrayContaining([
			'/_astro/itinerary-timeline-paper.css',
			'/_astro/gallery-index-choreography.css',
		]),
	);
}

describe('P0 persisted structural contracts', () => {
	it('requires the Xareni DB payload to carry explicit itinerary and gallery variants', () => {
		const payload = loadJson('tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json');
		assertCelestialProgramPath(payload, 'xareni-iyarit');
	});

	it('requires Xareni, América, and Ana Sofía corpus fixtures to take the program path', () => {
		for (const slug of ['xareni-iyarit', 'america-johana', 'ana-sofia-cota-guillen'] as const) {
			assertCelestialProgramPath(loadCorpusPublished(slug), slug);
		}
	});

	it('requires Abril definition itinerary to select ItineraryProgram without changing gallery', () => {
		const content = buildAbrilPublishedContent(
			assetMapFromSpecs<AbrilAssetMap>(ABRIL_ASSET_SPECS),
		);
		expect(content.itinerary).toMatchObject({ variant: 'timeline-paper' });

		const viewModel = adaptEvent({
			id: 'events/abril-michelle-becerra-rea',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');

		const cssUrls = resolveStructuralCss({
			themePreset: 'premiere-floral',
			itineraryVariant: viewModel.sections.itinerary?.variant,
			galleryVariant: viewModel.sections.gallery?.variant,
		});
		expect(cssUrls).toContain('/_astro/itinerary-timeline-paper.css');
		expect(cssUrls).not.toContain('/_astro/gallery-index-choreography.css');
	});

	it('keeps Romina itinerary on TimelineList / standard', () => {
		const content = buildRominaPublishedContent(
			assetMapFromSpecs<RominaAssetMap>(ROMINA_ASSET_SPECS),
		);
		expect(content.itinerary).toMatchObject({ variant: 'standard' });

		const viewModel = adaptEvent({
			id: 'events/romina-rios-chaparro',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.itinerary?.variant).toBe('standard');

		const cssUrls = resolveStructuralCss({
			themePreset: 'premiere-floral',
			itineraryVariant: viewModel.sections.itinerary?.variant,
			galleryVariant: viewModel.sections.gallery?.variant,
		});
		expect(cssUrls).not.toContain('/_astro/itinerary-timeline-paper.css');
		expect(cssUrls).not.toContain('/_astro/gallery-index-choreography.css');
	});

	it('rejects a payload when its itinerary variant is omitted', () => {
		const payload = structuredClone(
			loadJson('tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json'),
		);
		const itinerary = asRecord(payload.itinerary);
		if (itinerary) {
			delete itinerary.presentation;
			delete itinerary.variant;
		}

		const parsed = eventContentSchema.safeParse(payload);
		expect(parsed.success).toBe(false);
	});

	it('requires Xareni Thank You to take the editorial-back-cover path', () => {
		const payload = loadJson('tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json');
		expect(asRecord(payload.thankYou)?.variant).toBe('editorial-back-cover');

		const parsed = eventContentSchema.safeParse(payload);
		expect(parsed.success).toBe(true);
		expect(parsed.data?.thankYou?.variant).toBe('editorial-back-cover');

		const viewModel = adaptDbEvent({
			slug: 'xareni-iyarit',
			eventType: 'xv',
			isDemo: false,
			content: payload,
		});
		expect(viewModel.sections.thankYou?.variant).toBe('editorial-back-cover');
	});

	it('requires celestial and enchanted-rose corpus Thank You contracts to stay explicit', () => {
		for (const slug of [
			'xareni-iyarit',
			'america-johana',
			'ana-sofia-cota-guillen',
			'leah-lexa',
			'ayrin-samantha-lerma-castro',
		] as const) {
			const published = loadCorpusPublished(slug);
			const thankYou = asRecord(published.thankYou);
			expect(thankYou?.variant).toBe('editorial-back-cover');

			const parsed = eventContentSchema.safeParse(celestialEnvelope(published, slug));
			expect(parsed.success).toBe(true);
			expect(parsed.data?.thankYou?.variant).toBe('editorial-back-cover');
		}
	});

	it('keeps Romina Thank You on standard', () => {
		const content = buildRominaPublishedContent(
			assetMapFromSpecs<RominaAssetMap>(ROMINA_ASSET_SPECS),
		);
		expect(content.thankYou).toMatchObject({ variant: 'standard' });

		const viewModel = adaptEvent({
			id: 'events/romina-rios-chaparro',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.thankYou?.variant).toBe('standard');
	});

	it('rejects a payload when its Thank You variant is omitted', () => {
		const payload = structuredClone(
			loadJson('tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json'),
		);
		const thankYou = asRecord(payload.thankYou);
		if (thankYou) delete thankYou.variant;
		const parsed = eventContentSchema.safeParse(payload);
		expect(parsed.success).toBe(false);
	});
});
