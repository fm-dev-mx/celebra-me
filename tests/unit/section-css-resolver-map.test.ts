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
			'/src/styles/themes/sections/gallery/_magazine-spread.scss': {
				default: '/_astro/gallery-magazine-spread.css',
			},
			'/src/styles/themes/sections/gallery/_jewelry-box.scss': {
				default: '/_astro/gallery-jewelry-box.css',
			},
		});

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'magazine-spread')).toBe(
			'/_astro/gallery-magazine-spread.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'single')).toBeUndefined();
		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'luxury-hacienda',
				galleryVariant: 'magazine-spread',
			}),
		).toEqual(['/_astro/luxury-bundle.css', '/_astro/gallery-magazine-spread.css']);
	});

	it('resolves behavior-named Gallery CSS through the canonical partial map', () => {
		const sectionUrlMap = {
			gallery: {
				'magazine-spread': '/gallery-magazine-spread.css',
				'index-choreography': '/gallery-index-choreography.css',
			},
		};

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'magazine-spread')).toBe(
			'/gallery-magazine-spread.css',
		);
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'index-choreography')).toBe(
			'/gallery-index-choreography.css',
		);
	});

	it('loads semantic Gallery CSS even when the visual theme has the same historical origin', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial-magazine.scss': {
				default: '/_astro/editorial-magazine-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_magazine-spread.scss': {
				default: '/_astro/gallery-magazine-spread.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial-magazine',
				galleryVariant: 'magazine-spread',
			}),
		).toEqual(['/_astro/editorial-magazine-bundle.css', '/_astro/gallery-magazine-spread.css']);
	});

	it('loads structural partials independently when a semantic renderer differs from the theme', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/jewelry-box.scss': {
				default: '/_astro/jewelry-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/hero/_editorial-cover.scss': {
				default: '/_astro/hero-editorial.css',
			},
			'/src/styles/themes/sections/thank-you/_full-bleed-photo.scss': {
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
			'/src/styles/themes/sections/hero/_editorial-cover.scss': {
				default: '/_astro/hero-editorial.css',
			},
			'/src/styles/themes/sections/hero/_split-cover.scss': {
				default: '/_astro/hero-split-cover.css',
			},
			'/src/styles/themes/sections/gifts/_editorial-catalog.scss': {
				default: '/_astro/gifts-editorial.css',
			},
			'/src/styles/themes/sections/rsvp/_editorial-press-pass.scss': {
				default: '/_astro/rsvp-editorial.css',
			},
			'/src/styles/themes/sections/personalized-access/_editorial-pass.scss': {
				default: '/_astro/access-editorial.css',
			},
			'/src/styles/themes/sections/family/_split-groups.scss': {
				default: '/_astro/family-split-groups.css',
			},
			'/src/styles/themes/sections/location/_split-map.scss': {
				default: '/_astro/location-split-map.css',
			},
			'/src/styles/themes/sections/itinerary/_timeline-paper.scss': {
				default: '/_astro/itinerary-timeline-paper.css',
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
					itinerary: 'timeline-paper',
				},
			}),
		).toEqual([
			'/_astro/jewelry-bundle.css',
			'/_astro/hero-editorial.css',
			'/_astro/gifts-editorial.css',
			'/_astro/rsvp-editorial.css',
			'/_astro/access-editorial.css',
			'/_astro/family-split-groups.css',
			'/_astro/location-split-map.css',
			'/_astro/itinerary-timeline-paper.css',
		]);
	});

	it('delivers formal-pass and formal-register independently of theme identity', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial.scss': {
				default: '/_astro/editorial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/personalized-access/_formal-pass.scss': {
				default: '/_astro/access-formal-pass.css',
			},
			'/src/styles/themes/sections/rsvp/_formal-register.scss': {
				default: '/_astro/rsvp-formal-register.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial',
				structuralVariants: {
					rsvp: 'formal-register',
					personalizedAccess: 'formal-pass',
				},
			}),
		).toEqual([
			'/_astro/editorial-bundle.css',
			'/_astro/rsvp-formal-register.css',
			'/_astro/access-formal-pass.css',
		]);
	});

	it('does not load magazine thank-you geometry as a celestial structural override', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/celestial-blue.scss': {
				default: '/_astro/celestial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/thank-you/_editorial-back-cover.scss': {
				default: '/_astro/thank-you-editorial.css',
			},
			'/src/styles/themes/sections/thank-you/_full-bleed-photo.scss': {
				default: '/_astro/thank-you-full-bleed.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'celestial-blue',
				structuralVariants: { thankYou: 'editorial-back-cover' },
			}),
		).toEqual(['/_astro/celestial-bundle.css']);
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
			'/src/styles/themes/sections/gallery/_editorial-mosaic.scss': {
				default: '/_astro/gallery-editorial.css',
			},
			'/src/styles/themes/sections/gallery/_magazine-spread.scss': {
				default: '/_astro/gallery-magazine.css',
			},
			'/src/styles/themes/sections/gallery/_feature-mosaic.scss': {
				default: '/_astro/gallery-feature.css',
			},
			'/src/styles/themes/sections/gallery/_index-choreography.scss': {
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

	it('keeps legacy Gallery theme aliases out of the canonical CSS resolver', () => {
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/gallery/_editorial-mosaic.scss': {
				default: '/_astro/gallery-editorial.css',
			},
		});

		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'premiere-floral')).toBeUndefined();
		expect(resolveGalleryVariantCssUrl(sectionUrlMap, 'not-a-gallery-variant')).toBeUndefined();
	});

	it('loads premiere-floral reveal CSS when envelope.variant differs from the theme', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/editorial.scss': {
				default: '/_astro/editorial-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_premiere-floral.scss': {
				default: '/_astro/reveal-premiere-floral.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'editorial',
				envelopeVariant: 'premiere-floral',
			}),
		).toEqual(['/_astro/editorial-bundle.css', '/_astro/reveal-premiere-floral.css']);
	});

	it('does not add duplicate reveal CSS when envelope.variant matches the theme preset', () => {
		const bundleUrlMap = buildSectionBundleUrlMap({
			'/src/styles/invitation-sections-by-preset/premiere-floral.scss': {
				default: '/_astro/premiere-floral-bundle.css',
			},
		});
		const sectionUrlMap = buildSectionUrlMap({
			'/src/styles/themes/sections/reveal/_premiere-floral.scss': {
				default: '/_astro/reveal-premiere-floral.css',
			},
		});

		expect(
			resolveInvitationCssUrls(bundleUrlMap, sectionUrlMap, {
				themePreset: 'premiere-floral',
				envelopeVariant: 'premiere-floral',
			}),
		).toEqual(['/_astro/premiere-floral-bundle.css']);
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
