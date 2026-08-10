import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import { resolveItineraryPresentation } from '@/lib/invitation/itinerary-presentation';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
	resolveInvitationCssUrls,
} from '@/lib/invitation/section-css-resolver-map';
import { prepareInvitationPageContext } from '@/lib/invitation/page-data';
import {
	resolveFamilyStructuralVariant,
	resolveGalleryLayoutVariant,
	resolveGiftsStructuralVariant,
	resolveHeroStructuralVariant,
	resolveLocationStructuralVariant,
	resolvePersonalizedAccessStructuralVariant,
	resolveRsvpStructuralVariant,
} from '@/lib/invitation/structural-variants';

jest.mock('@/lib/assets/asset-registry', () => {
	const actual = jest.requireActual('@/lib/assets/asset-registry');
	return {
		...actual,
		getEventAsset: jest.fn(() => ({
			src: '/test-asset.webp',
			width: 1,
			height: 1,
			format: 'webp',
		})),
	};
});

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readSource(relativePath: string) {
	return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

type PortableOverrides = {
	heroStructuralVariant?: string;
	familyStructuralVariant?: string;
	locationStructuralVariant?: string;
	galleryVariant?: string;
	giftsStructuralVariant?: string;
	rsvpStructuralVariant?: string;
	personalizedAccessStructuralVariant?: string;
	itineraryBehavior?: 'standard' | 'timeline-paper';
	/** Optional theme skin; structural selection must not depend on it. */
	themePreset?: string;
};

/**
 * Non-origin portability fixture: jewelry-box demo content (not Romina / Alba / Daniela /
 * Victoria / Abril / Valentina). Only canonical structural/behavior selectors are applied in memory.
 */
function buildPortableJewelryBoxEvent(overrides: PortableOverrides = {}) {
	const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
	const data = {
		...fixture,
		...(overrides.themePreset
			? { theme: { ...fixture.theme, preset: overrides.themePreset } }
			: {}),
		hero: {
			...fixture.hero,
			...(overrides.heroStructuralVariant
				? { structuralVariant: overrides.heroStructuralVariant }
				: {}),
		},
		family: {
			...fixture.family,
			...(overrides.familyStructuralVariant
				? { structuralVariant: overrides.familyStructuralVariant }
				: {}),
		},
		location: {
			...fixture.location,
			...(overrides.locationStructuralVariant
				? { structuralVariant: overrides.locationStructuralVariant }
				: {}),
		},
		gallery: {
			...fixture.gallery,
			...(overrides.galleryVariant ? { variant: overrides.galleryVariant } : {}),
		},
		sectionStyles: {
			...fixture.sectionStyles,
			...(overrides.giftsStructuralVariant
				? {
						gifts: {
							...fixture.sectionStyles?.gifts,
							structuralVariant: overrides.giftsStructuralVariant,
						},
					}
				: {}),
			...(overrides.rsvpStructuralVariant
				? {
						rsvp: {
							...fixture.sectionStyles?.rsvp,
							structuralVariant: overrides.rsvpStructuralVariant,
						},
					}
				: {}),
		},
		rsvp: {
			...fixture.rsvp,
			...(overrides.personalizedAccessStructuralVariant
				? {
						personalizedAccess: {
							...fixture.rsvp?.personalizedAccess,
							structuralVariant: overrides.personalizedAccessStructuralVariant,
						},
					}
				: {}),
		},
		itinerary: {
			...fixture.itinerary,
			...(overrides.itineraryBehavior
				? { presentation: { behavior: overrides.itineraryBehavior } }
				: {}),
		},
	};

	// Identity fields must stay absent for portability proofs.
	delete (data as { visualProfileId?: string }).visualProfileId;

	return {
		id: 'event-demos/xv/demo-xv-jewelry-box',
		data,
	} as Parameters<typeof adaptEvent>[0];
}

function loadDemoEvent(relativePath: string, id: string) {
	const fixture = loadFixture(relativePath);
	delete (fixture as { visualProfileId?: string }).visualProfileId;
	return {
		id,
		data: fixture,
	} as Parameters<typeof adaptEvent>[0];
}

describe('Goal 3 — non-origin structural variant portability', () => {
	it('applies Hero split-cover to jewelry-box demo content without schema transformation', () => {
		const event = buildPortableJewelryBoxEvent({ heroStructuralVariant: 'split-cover' });
		const viewModel = adaptEvent(event);

		expect(event.data.theme.preset).toBe('jewelry-box');
		expect(event.data._assetSlug).toBe('demo-xv-jewelry-box');
		expect(event.data).not.toHaveProperty('visualProfileId');
		expect(viewModel.hero.structuralVariant).toBe('split-cover');
		expect(viewModel.hero.structuralVariantExplicit).toBe(true);
		expect(viewModel.hero.backgroundImage).toBeTruthy();
		expect(viewModel.hero.name).toBeTruthy();
		expect(viewModel.hero.date).toBeTruthy();
		expect(resolveHeroStructuralVariant('split-cover')).toBe('split-cover');
	});

	it('applies Hero editorial-cover on jewelry-box without editorial-magazine theme fallback', () => {
		// Origin consumer remains editorial-magazine demos; jewelry-box proves identity-free portability.
		const event = buildPortableJewelryBoxEvent({
			heroStructuralVariant: 'editorial-cover',
			themePreset: 'jewelry-box',
		});
		const viewModel = adaptEvent(event);

		expect(event.data.theme.preset).toBe('jewelry-box');
		expect(event.data).not.toHaveProperty('visualProfileId');
		expect(viewModel.hero.structuralVariant).toBe('editorial-cover');
		expect(viewModel.hero.structuralVariantExplicit).toBe(true);
		expect(resolveHeroStructuralVariant('editorial-cover')).toBe(
			'editorial-cover',
		);
		expect(resolveHeroStructuralVariant(undefined)).toBe('standard');
	});

	it('applies Family split-groups without Daniela/Victoria identity', () => {
		const event = buildPortableJewelryBoxEvent({ familyStructuralVariant: 'split-groups' });
		const viewModel = adaptEvent(event);

		expect(event.data).not.toHaveProperty('visualProfileId');
		expect(viewModel.sections.family?.structuralVariant).toBe('split-groups');
		expect(viewModel.sections.family?.structuralVariantExplicit).toBe(true);
		expect(resolveFamilyStructuralVariant('split-groups')).toBe('split-groups');
	});

	it('applies Location split-map to jewelry-box demo content with existing venue/map media', () => {
		const event = buildPortableJewelryBoxEvent({ locationStructuralVariant: 'split-map' });
		const viewModel = adaptEvent(event);
		const location = viewModel.sections.location;

		expect(location?.structuralVariant).toBe('split-map');
		expect(location?.structuralVariantExplicit).toBe(true);
		expect(location?.ceremony?.venueName).toBeTruthy();
		expect(location?.ceremony?.coordinates).toEqual(
			expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
		);
		expect(location?.ceremony?.googleMapsUrl || location?.ceremony?.mapUrl).toBeTruthy();
		expect(location?.ceremony?.image).toBeTruthy();
		expect(location?.reception?.coordinates).toEqual(
			expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
		);
		expect(resolveLocationStructuralVariant('split-map')).toBe('split-map');
	});

	it('ports gallery layouts via adaptEvent on non-origin demos/overrides', () => {
		const magazine = adaptEvent(
			loadDemoEvent(
				'src/content/event-demos/xv/demo-xv-editorial-magazine.json',
				'event-demos/xv/demo-xv-editorial-magazine',
			),
		);
		expect(magazine.sections.gallery?.variant).toBe('magazine-spread');
		expect(magazine.sections.gallery?.structuralVariantExplicit).toBe(true);

		const keepsakeEvent = buildPortableJewelryBoxEvent({ galleryVariant: 'single-keepsake' });
		const keepsake = adaptEvent(keepsakeEvent);
		expect(keepsakeEvent.data).not.toHaveProperty('visualProfileId');
		expect(keepsake.sections.gallery?.variant).toBe('single-keepsake');
		expect(keepsake.sections.gallery?.structuralVariantExplicit).toBe(true);

		const index = adaptEvent(
			loadDemoEvent(
				'src/content/event-demos/xv/demo-xv-celestial-blue.json',
				'event-demos/xv/demo-xv-celestial-blue',
			),
		);
		expect(index.sections.gallery?.variant).toBe('index-choreography');
		expect(index.sections.gallery?.structuralVariantExplicit).toBe(true);

		// jewelry-box demo already authors feature-mosaic; re-assert under a non-origin theme skin.
		const mosaicEvent = buildPortableJewelryBoxEvent({
			galleryVariant: 'feature-mosaic',
			themePreset: 'premiere-floral',
		});
		const mosaic = adaptEvent(mosaicEvent);
		expect(mosaic.theme.preset).toBe('premiere-floral');
		expect(mosaic.sections.gallery?.variant).toBe('feature-mosaic');
		expect(mosaic.sections.gallery?.structuralVariantExplicit).toBe(true);

		expect(resolveGalleryLayoutVariant('magazine-spread')).toBe('magazine-spread');
		expect(resolveGalleryLayoutVariant('single-keepsake')).toBe('single-keepsake');
		expect(resolveGalleryLayoutVariant('index-choreography')).toBe('index-choreography');
		expect(resolveGalleryLayoutVariant('feature-mosaic')).toBe('feature-mosaic');
	});

	it('applies Gifts editorial-catalog and RSVP editorial-press-pass without invitation identity', () => {
		const event = buildPortableJewelryBoxEvent({
			giftsStructuralVariant: 'editorial-catalog',
			rsvpStructuralVariant: 'editorial-press-pass',
		});
		const viewModel = adaptEvent(event);

		expect(event.data).not.toHaveProperty('visualProfileId');
		expect(viewModel.sections.gifts?.structuralVariant).toBe('editorial-catalog');
		expect(viewModel.sections.gifts?.structuralVariantExplicit).toBe(true);
		expect(viewModel.sections.rsvp?.structuralVariant).toBe('editorial-press-pass');
		expect(viewModel.sections.rsvp?.structuralVariantExplicit).toBe(true);
		expect(resolveGiftsStructuralVariant('editorial-catalog')).toBe('editorial-catalog');
		expect(resolveRsvpStructuralVariant('editorial-press-pass')).toBe('editorial-press-pass');
	});

	it('applies Personalized Access ornamented and editorial-pass without invitation identity', () => {
		const ornamentedEvent = buildPortableJewelryBoxEvent({
			personalizedAccessStructuralVariant: 'ornamented',
		});
		const ornamented = adaptEvent(ornamentedEvent);
		expect(ornamentedEvent.data).not.toHaveProperty('visualProfileId');
		expect(ornamented.sections.rsvp?.personalizedAccess?.structuralVariant).toBe('ornamented');
		expect(ornamented.sections.rsvp?.personalizedAccess?.structuralVariantExplicit).toBe(true);

		// Second managed consumer of editorial-pass is editorial-magazine demos; jewelry-box proves portability.
		const editorialPassEvent = buildPortableJewelryBoxEvent({
			personalizedAccessStructuralVariant: 'editorial-pass',
		});
		const editorialPass = adaptEvent(editorialPassEvent);
		expect(editorialPass.sections.rsvp?.personalizedAccess?.structuralVariant).toBe(
			'editorial-pass',
		);
		expect(editorialPass.sections.rsvp?.personalizedAccess?.structuralVariantExplicit).toBe(
			true,
		);

		expect(resolvePersonalizedAccessStructuralVariant('ornamented')).toBe('ornamented');
		expect(resolvePersonalizedAccessStructuralVariant('editorial-pass')).toBe('editorial-pass');
	});

	it('selects Itinerary timeline-paper and standard from presentation.behavior only', () => {
		const standardEvent = buildPortableJewelryBoxEvent({ itineraryBehavior: 'standard' });
		const standard = adaptEvent(standardEvent);
		expect(standard.sections.itinerary?.variant).toBe('standard');
		expect(resolveItineraryPresentation({ behavior: 'standard' })).toBe('standard');

		const paperEvent = buildPortableJewelryBoxEvent({
			itineraryBehavior: 'timeline-paper',
			themePreset: 'jewelry-box',
		});
		const paper = adaptEvent(paperEvent);
		expect(paper.theme.preset).toBe('jewelry-box');
		expect(paper.sections.itinerary?.variant).toBe('timeline-paper');
		expect(resolveItineraryPresentation({ behavior: 'timeline-paper' })).toBe('timeline-paper');
		// Theme name alone must not select paper behavior after alias retirement.
		expect(resolveItineraryPresentation(undefined)).toBe('standard');
	});

	it('passes portable structural variants through section render descriptors', () => {
		const event = buildPortableJewelryBoxEvent({
			heroStructuralVariant: 'split-cover',
			locationStructuralVariant: 'split-map',
			familyStructuralVariant: 'split-groups',
			galleryVariant: 'magazine-spread',
			giftsStructuralVariant: 'editorial-catalog',
			rsvpStructuralVariant: 'editorial-press-pass',
			personalizedAccessStructuralVariant: 'editorial-pass',
			itineraryBehavior: 'timeline-paper',
		});
		const pageContext = prepareInvitationPageContext({
			eventEntry: event as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'],
			slug: 'demo-xv-jewelry-box',
		});

		expect(pageContext.viewModel.hero.structuralVariant).toBe('split-cover');
		expect(pageContext.viewModel.theme.preset).toBe('jewelry-box');
		expect(pageContext.viewModel.sections.itinerary?.variant).toBe('timeline-paper');
		expect(pageContext.viewModel.sections.gallery?.variant).toBe('magazine-spread');

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		expect(descriptors.find((d) => d.component === 'location')).toMatchObject({
			component: 'location',
			props: {
				structuralVariant: 'split-map',
				structuralVariantExplicit: true,
			},
		});
		expect(descriptors.find((d) => d.component === 'family')).toMatchObject({
			props: {
				structuralVariant: 'split-groups',
				structuralVariantExplicit: true,
			},
		});
		expect(descriptors.find((d) => d.component === 'gifts')).toMatchObject({
			props: {
				structuralVariant: 'editorial-catalog',
				structuralVariantExplicit: true,
			},
		});
		expect(descriptors.find((d) => d.component === 'rsvp')).toMatchObject({
			props: {
				structuralVariant: 'editorial-press-pass',
				structuralVariantExplicit: true,
			},
		});
	});

	it('delivers structural CSS under jewelry-box without origin profile identity', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/hero/_split-cover.scss': {
				default: '/_astro/hero-split-cover.css',
			},
			'/src/styles/themes/sections/location/_split-map.scss': {
				default: '/_astro/location-split-map.css',
			},
			'/src/styles/themes/sections/family/_split-groups.scss': {
				default: '/_astro/family-split-groups.css',
			},
			'/src/styles/themes/sections/gallery/_editorial-magazine.scss': {
				default: '/_astro/gallery-magazine-spread.css',
			},
		});
		const profileUrlMap = {
			'romina-rios-chaparro': '/_astro/romina-profile.css',
			'alba-rosa-quinonez': '/_astro/alba-profile.css',
			'daniela-y-martin': '/_astro/daniela-profile.css',
			'victoria-y-roberto': '/_astro/victoria-profile.css',
		};

		const urls = resolveInvitationCssUrls(
			bundleUrlMap,
			sectionUrlMap,
			{
				themePreset: 'jewelry-box',
				// Explicitly omit slug / visualProfileId — structure must not need them.
				galleryVariant: 'magazine-spread',
				structuralVariants: {
					hero: 'split-cover',
					location: 'split-map',
					family: 'split-groups',
				},
			},
			profileUrlMap,
		);

		expect(urls).toEqual([
			'/_astro/jewelry-bundle.css',
			'/_astro/gallery-magazine-spread.css',
			'/_astro/hero-split-cover.css',
			'/_astro/location-split-map.css',
			'/_astro/family-split-groups.css',
		]);
		expect(urls.join('\n')).not.toMatch(/romina|alba-rosa|daniela|victoria|abril|valentina/i);
	});

	it('keeps canonical structural CSS free of origin slug/profile/theme identity', () => {
		const splitCover = readSource('src/styles/themes/sections/hero/_split-cover.scss');
		const splitMap = readSource('src/styles/themes/sections/location/_split-map.scss');
		const splitGroups = readSource('src/styles/themes/sections/family/_split-groups.scss');
		const combined = `${splitCover}\n${splitMap}\n${splitGroups}`;

		expect(combined).toContain(".invitation-hero[data-structural-variant='split-cover']");
		expect(combined).toContain(".event-location[data-structural-variant='split-map']");
		expect(combined).toContain(".family[data-structural-variant='split-groups']");
		expect(combined).not.toMatch(/romina|alba-rosa|daniela-y-martin|visualProfileId/i);
		expect(combined).toMatch(/respond-to\(lg\)|min-width|width\s*>=\s*768px/);
		expect(combined).toMatch(/width\s*<\s*768px|respond-below/);
	});

	it('does not require origin profile SCSS to own the structural grids', () => {
		const romina = readSource('src/styles/invitation-profiles/romina-rios-chaparro.scss');
		const alba = readSource('src/styles/invitation-profiles/alba-rosa-quinonez.scss');

		// Profiles may tint tokens; they must not redefine geometry owned by the canonical partial.
		expect(romina).not.toContain('--hero-split-photo-width');
		expect(romina).not.toContain('--hero-split-content-width');
		expect(romina).not.toContain('object-fit: contain');
		expect(romina).not.toContain('object-position: right center');
		expect(alba).not.toContain('--location-split-map-min');
		expect(alba).not.toContain('--location-split-content-basis');
		expect(alba).not.toContain('grid-template-areas:');
		expect(alba).not.toMatch(/grid-template-areas:\s*['"]content map['"]/);
	});
});
