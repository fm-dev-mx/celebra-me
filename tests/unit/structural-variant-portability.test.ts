import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationSectionRenderDescriptors } from '@/lib/invitation/section-render-data';
import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
	resolveInvitationCssUrls,
} from '@/lib/invitation/section-css-resolver-map';
import { prepareInvitationPageContext } from '@/lib/invitation/page-data';

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

/**
 * Non-origin portability fixture: jewelry-box demo content (not Romina / not Alba).
 * Only the canonical structuralVariant selectors are applied in memory.
 */
function buildPortableJewelryBoxEvent(overrides: {
	heroStructuralVariant?: string;
	locationStructuralVariant?: string;
}) {
	const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
	return {
		id: 'event-demos/xv/demo-xv-jewelry-box',
		data: {
			...fixture,
			hero: {
				...fixture.hero,
				...(overrides.heroStructuralVariant
					? { structuralVariant: overrides.heroStructuralVariant }
					: {}),
			},
			location: {
				...fixture.location,
				...(overrides.locationStructuralVariant
					? { structuralVariant: overrides.locationStructuralVariant }
					: {}),
			},
		},
	} as Parameters<typeof adaptEvent>[0];
}

describe('Goal B.1 — non-origin structural variant portability', () => {
	it('applies Hero split-cover to jewelry-box demo content without schema transformation', () => {
		const event = buildPortableJewelryBoxEvent({ heroStructuralVariant: 'split-cover' });
		const viewModel = adaptEvent(event);

		expect(event.data.theme.preset).toBe('jewelry-box');
		expect(event.data._assetSlug).toBe('demo-xv-jewelry-box');
		expect(viewModel.hero.structuralVariant).toBe('split-cover');
		expect(viewModel.hero.structuralVariantExplicit).toBe(true);
		expect(viewModel.hero.backgroundImage).toBeTruthy();
		expect(viewModel.hero.name).toBeTruthy();
		expect(viewModel.hero.date).toBeTruthy();
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
	});

	it('passes portable structural variants through section render descriptors', () => {
		const event = buildPortableJewelryBoxEvent({
			heroStructuralVariant: 'split-cover',
			locationStructuralVariant: 'split-map',
		});
		const pageContext = prepareInvitationPageContext({
			eventEntry: event as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'],
			slug: 'demo-xv-jewelry-box',
		});

		expect(pageContext.viewModel.hero.structuralVariant).toBe('split-cover');
		expect(pageContext.viewModel.theme.preset).toBe('jewelry-box');

		const locationDescriptor = buildInvitationSectionRenderDescriptors(pageContext).find(
			(descriptor) => descriptor.component === 'location',
		);

		expect(locationDescriptor).toMatchObject({
			component: 'location',
			props: {
				structuralVariant: 'split-map',
				structuralVariantExplicit: true,
			},
		});
	});

	it('delivers split-cover and split-map CSS under jewelry-box without origin profile identity', () => {
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
		});
		const profileUrlMap = {
			'romina-rios-chaparro': '/_astro/romina-profile.css',
			'alba-rosa-quinonez': '/_astro/alba-profile.css',
		};

		const urls = resolveInvitationCssUrls(
			bundleUrlMap,
			sectionUrlMap,
			{
				themePreset: 'jewelry-box',
				// Explicitly omit slug / visualProfileId — structure must not need them.
				structuralVariants: {
					hero: 'split-cover',
					location: 'split-map',
				},
			},
			profileUrlMap,
		);

		expect(urls).toEqual([
			'/_astro/jewelry-bundle.css',
			'/_astro/hero-split-cover.css',
			'/_astro/location-split-map.css',
		]);
		expect(urls).not.toContain('/_astro/romina-profile.css');
		expect(urls).not.toContain('/_astro/alba-profile.css');
	});

	it('keeps canonical structural CSS free of origin slug/profile/theme identity', () => {
		const splitCover = readSource('src/styles/themes/sections/hero/_split-cover.scss');
		const splitMap = readSource('src/styles/themes/sections/location/_split-map.scss');
		const combined = `${splitCover}\n${splitMap}`;

		expect(combined).toContain(".invitation-hero[data-structural-variant='split-cover']");
		expect(combined).toContain(".event-location[data-structural-variant='split-map']");
		expect(combined).not.toMatch(/romina|alba-rosa|visualProfileId|premiere-floral/i);
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
