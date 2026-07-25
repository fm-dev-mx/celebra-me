import {
	buildSectionBundleUrlMap,
	buildInvitationProfileUrlMap,
	buildSectionUrlMap,
	resolveInvitationCssUrls,
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
