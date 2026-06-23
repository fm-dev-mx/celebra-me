import {
	buildSectionBundleUrlMap,
	buildSectionUrlMap,
	resolveSectionBundleCssUrl,
	resolveSectionCssUrl,
	resolveSectionCssUrls,
} from '@/lib/invitation/section-css-resolver-map';

describe('section-css-resolver-map', () => {
	const modules = {
		'/src/styles/invitation-sections/gallery/jewelry-box.scss': {
			default: '/_astro/gallery-jewelry-box.css',
		},
		'/src/styles/invitation-sections/gallery/editorial.scss': {
			default: '/_astro/gallery-editorial.css',
		},
		'/src/styles/invitation-sections/hero/jewelry-box.scss': {
			default: '/_astro/hero-jewelry-box.css',
		},
		'/src/styles/invitation-sections/hero/editorial.scss': {
			default: '/_astro/hero-editorial.css',
		},
	};

	it('builds section URL maps from glob module defaults', () => {
		expect(buildSectionUrlMap(modules)).toEqual({
			gallery: {
				'jewelry-box': '/_astro/gallery-jewelry-box.css',
				editorial: '/_astro/gallery-editorial.css',
			},
			hero: {
				'jewelry-box': '/_astro/hero-jewelry-box.css',
				editorial: '/_astro/hero-editorial.css',
			},
		});
	});

	it('resolves preset aliases and returns undefined for base-only fallbacks', () => {
		const sectionUrlMap = buildSectionUrlMap(modules);
		const heroPresetToEntrypoint = {
			'jewelry-box': 'jewelry-box',
			'premiere-floral': 'editorial',
		};

		expect(
			resolveSectionCssUrl(sectionUrlMap, 'hero', heroPresetToEntrypoint, 'premiere-floral'),
		).toBe('/_astro/hero-editorial.css');
		expect(
			resolveSectionCssUrl(
				sectionUrlMap,
				'hero',
				heroPresetToEntrypoint,
				'jewelry-box-wedding',
			),
		).toBeUndefined();
	});

	it('resolves available section URLs without emitting base-only fallbacks', () => {
		const sectionUrlMap = buildSectionUrlMap(modules);
		const configs = [
			{
				section: 'gallery',
				presetToEntrypoint: {
					'premiere-floral': 'editorial',
				},
			},
			{
				section: 'hero',
				presetToEntrypoint: {
					'premiere-floral': 'editorial',
				},
			},
			{
				section: 'rsvp',
				presetToEntrypoint: {
					'premiere-floral': 'premiere-floral',
				},
			},
		];

		expect(resolveSectionCssUrls(sectionUrlMap, configs, 'premiere-floral')).toEqual([
			'/_astro/gallery-editorial.css',
			'/_astro/hero-editorial.css',
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
});
