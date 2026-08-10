import {
	buildSectionBundleUrlMap,
	buildInvitationProfileUrlMap,
	buildSectionUrlMap,
	resolveInvitationCssUrls,
	resolveGalleryVariantCssUrl,
	resolveSectionBundleCssUrl,
	resolveSectionCssUrl,
	resolveSectionCssUrls,
} from '@/lib/invitation/section-css-resolver-map';

describe('section-css-resolver-map', () => {
	const modules = {
		'/src/styles/themes/sections/footer/_editorial.scss': {
			default: '/_astro/footer-editorial.css',
		},
		'/src/styles/themes/sections/footer/_enchanted-rose.scss': {
			default: '/_astro/footer-enchanted-rose.css',
		},
	};

	it('builds section URL maps from canonical partial module defaults', () => {
		expect(buildSectionUrlMap(modules)).toEqual({
			footer: {
				editorial: '/_astro/footer-editorial.css',
				'enchanted-rose': '/_astro/footer-enchanted-rose.css',
			},
		});
	});

	it('resolves preset aliases and returns undefined for base-only fallbacks', () => {
		const sectionUrlMap = buildSectionUrlMap(modules);
		const footerPresetToEntrypoint = {
			editorial: 'editorial',
			'enchanted-rose': 'enchanted-rose',
		};

		expect(
			resolveSectionCssUrl(
				sectionUrlMap,
				'footer',
				footerPresetToEntrypoint,
				'enchanted-rose',
			),
		).toBe('/_astro/footer-enchanted-rose.css');
		expect(
			resolveSectionCssUrl(
				sectionUrlMap,
				'footer',
				footerPresetToEntrypoint,
				'luxury-hacienda',
			),
		).toBeUndefined();
	});

	it('resolves available section URLs without emitting base-only fallbacks', () => {
		const sectionUrlMap = buildSectionUrlMap(modules);
		const configs = [
			{
				section: 'footer',
				presetToEntrypoint: {
					'enchanted-rose': 'enchanted-rose',
				},
			},
			{
				section: 'missing',
				presetToEntrypoint: {
					'enchanted-rose': 'enchanted-rose',
				},
			},
		];

		expect(resolveSectionCssUrls(sectionUrlMap, configs, 'enchanted-rose')).toEqual([
			'/_astro/footer-enchanted-rose.css',
		]);
	});

	it('builds preset section bundle maps from glob module defaults', () => {
		const bundleModules = {
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-box-bundle.css',
			},
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-blue-bundle.css',
			},
		};

		expect(buildSectionBundleUrlMap(bundleModules)).toEqual({
			'jewelry-box': '/_astro/jewelry-box-bundle.css',
			'celestial-blue': '/_astro/celestial-blue-bundle.css',
		});
	});

	it('resolves one section bundle URL per preset without returning module objects', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-box-bundle.css',
			},
		});

		expect(resolveSectionBundleCssUrl(bundleUrlMap, 'jewelry-box')).toBe(
			'/_astro/jewelry-box-bundle.css',
		);
		expect(resolveSectionBundleCssUrl(bundleUrlMap, 'missing-preset')).toBeUndefined();
		expect(typeof resolveSectionBundleCssUrl(bundleUrlMap, 'jewelry-box')).toBe('string');
	});

	it('adds footer variant CSS when the rendered footer variant differs from the theme preset', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial.scss': {
				default: '/_astro/editorial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/footer/_editorial.scss': {
				default: '/_astro/footer-editorial.css',
			},
			'/src/styles/themes/sections/footer/_enchanted-rose.scss': {
				default: '/_astro/footer-enchanted-rose.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial',
				footerVariant: 'enchanted-rose',
			}),
		).toEqual(['/_astro/editorial-bundle.css', '/_astro/footer-enchanted-rose.css']);
	});

	it('loads Gallery variant CSS independently from the active theme bundle', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/luxury-hacienda.scss': {
				default: '/_astro/luxury-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_editorial-magazine.scss': {
				default: '/_astro/gallery-editorial-magazine.css',
			},
			'/src/styles/themes/sections/gallery/_jewelry-box.scss': {
				default: '/_astro/gallery-jewelry-box.css',
			},
		});

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'editorial-magazine')).toBe(
			'/_astro/gallery-editorial-magazine.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'single')).toBeUndefined();
		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'luxury-hacienda',
				galleryVariant: 'editorial-magazine',
			}),
		).toEqual(['/_astro/luxury-bundle.css', '/_astro/gallery-editorial-magazine.css']);
	});

	it('resolves behavior-named Gallery CSS through the canonical partial map', () => {
		const sectionUrlMap = {
			gallery: {
				'editorial-magazine': '/gallery-editorial-magazine.css',
				'celestial-blue': '/gallery-celestial.css',
			},
		};

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'magazine-spread')).toBe(
			'/gallery-editorial-magazine.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'index-choreography')).toBe(
			'/gallery-celestial.css',
		);
	});

	it('does not duplicate Gallery CSS when a semantic variant maps to the active theme', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial-magazine.scss': {
				default: '/_astro/editorial-magazine-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_editorial-magazine.scss': {
				default: '/_astro/gallery-editorial-magazine.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial-magazine',
				galleryVariant: 'magazine-spread',
			}),
		).toEqual(['/_astro/editorial-magazine-bundle.css']);
	});

	it('loads structural partials independently when a semantic renderer differs from the theme', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/hero/_editorial-magazine.scss': {
				default: '/_astro/hero-editorial.css',
			},
			'/src/styles/themes/sections/thank-you/_sacred-keepsake.scss': {
				default: '/_astro/thank-you-sacred.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'jewelry-box',
				structuralVariants: { hero: 'editorial-cover', thankYou: 'full-bleed-photo' },
			}),
		).toEqual([
			'/_astro/jewelry-bundle.css',
			'/_astro/hero-editorial.css',
			'/_astro/thank-you-sacred.css',
		]);
	});

	it('delivers every non-default structural partial independently of the active theme', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/hero/_editorial-magazine.scss': {
				default: '/_astro/hero-editorial.css',
			},
			'/src/styles/themes/sections/hero/_split-cover.scss': {
				default: '/_astro/hero-split-cover.css',
			},
			'/src/styles/themes/sections/thank-you/_editorial-magazine.scss': {
				default: '/_astro/thank-you-editorial.css',
			},
			'/src/styles/themes/sections/gifts/_editorial-magazine.scss': {
				default: '/_astro/gifts-editorial.css',
			},
			'/src/styles/themes/sections/rsvp/_editorial-magazine.scss': {
				default: '/_astro/rsvp-editorial.css',
			},
			'/src/styles/themes/sections/personalized-access/_editorial-magazine.scss': {
				default: '/_astro/access-editorial.css',
			},
			'/src/styles/themes/sections/family/_split-groups.scss': {
				default: '/_astro/family-split-groups.css',
			},
			'/src/styles/themes/sections/location/_split-map.scss': {
				default: '/_astro/location-split-map.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'jewelry-box',
				structuralVariants: {
					hero: 'editorial-cover',
					thankYou: 'editorial-back-cover',
					gifts: 'editorial-catalog',
					rsvp: 'editorial-press-pass',
					personalizedAccess: 'editorial-pass',
					family: 'split-groups',
					location: 'split-map',
				},
			}),
		).toEqual([
			'/_astro/jewelry-bundle.css',
			'/_astro/hero-editorial.css',
			'/_astro/thank-you-editorial.css',
			'/_astro/gifts-editorial.css',
			'/_astro/rsvp-editorial.css',
			'/_astro/access-editorial.css',
			'/_astro/family-split-groups.css',
			'/_astro/location-split-map.css',
		]);
	});

	it('delivers split-cover and split-map without origin profile or theme identity', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-bundle.css',
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
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'celestial-blue',
				structuralVariants: {
					hero: 'split-cover',
					family: 'split-groups',
					location: 'split-map',
				},
			}),
		).toEqual([
			'/_astro/celestial-bundle.css',
			'/_astro/hero-split-cover.css',
			'/_astro/family-split-groups.css',
			'/_astro/location-split-map.css',
		]);
	});

	it('maps canonical Gallery layouts to independent CSS only where a partial is required', () => {
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_editorial.scss': {
				default: '/_astro/gallery-editorial.css',
			},
			'/src/styles/themes/sections/gallery/_editorial-magazine.scss': {
				default: '/_astro/gallery-magazine.css',
			},
			'/src/styles/themes/sections/gallery/_luxury-hacienda.scss': {
				default: '/_astro/gallery-feature.css',
			},
			'/src/styles/themes/sections/gallery/_celestial-blue.scss': {
				default: '/_astro/gallery-index.css',
			},
		});

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'uniform-grid')).toBeUndefined();
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'single-keepsake')).toBeUndefined();
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'editorial-mosaic')).toBe(
			'/_astro/gallery-editorial.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'magazine-spread')).toBe(
			'/_astro/gallery-magazine.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'feature-mosaic')).toBe(
			'/_astro/gallery-feature.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'index-choreography')).toBe(
			'/_astro/gallery-index.css',
		);
	});

	it('keeps Gallery aliases and unknown variants deterministic', () => {
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_editorial.scss': {
				default: '/_astro/gallery-editorial.css',
			},
		});

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'premiere-floral')).toBe(
			'/_astro/gallery-editorial.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'not-a-gallery-variant')).toBeUndefined();
	});

	it('does not add duplicate footer CSS when the footer follows the theme preset', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial.scss': {
				default: '/_astro/editorial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/footer/_editorial.scss': {
				default: '/_astro/footer-editorial.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial',
				footerVariant: 'editorial',
			}),
		).toEqual(['/_astro/editorial-bundle.css']);
	});

	it('loads only the active visual profile and deduplicates repeated URLs', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial-magazine.scss': {
				default: '/_astro/editorial-magazine-bundle.css',
			},
		});
		const profileUrlMap = buildInvitationProfileUrlMap({
			'/src/styles/invitation-profiles/valentina-hernandez.scss': {
				default: '/_astro/valentina-profile.css',
			},
			'/src/styles/invitation-profiles/xareni-iyarit.scss': {
				default: '/_astro/xareni-profile.css',
			},
		});

		expect(
			resolveInvitationCssUrls(
				bundleUrlMap,
				{},
				{
					themePreset: 'editorial-magazine',
					visualProfileId: 'valentina-hernandez',
				},
				profileUrlMap,
			),
		).toEqual(['/_astro/editorial-magazine-bundle.css', '/_astro/valentina-profile.css']);
	});
});
