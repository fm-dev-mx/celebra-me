type CssModule = { default: string };

export type SectionUrlMap = Record<string, Record<string, string>>;
export type SectionBundleUrlMap = Record<string, string>;
export type InvitationProfileUrlMap = Record<string, string>;

type SectionCssConfig = {
	section: string;
	presetToEntrypoint: Record<string, string>;
};

type InvitationCssInput = {
	themePreset: string;
	footerVariant?: string;
	galleryVariant?: string;
	visualProfileId?: string;
	slug?: string;
};

const FOOTER_PRESET_TO_ENTRYPOINT: Record<string, string> = {
	editorial: 'editorial',
	'premiere-floral': 'premiere-floral',
	'enchanted-rose': 'enchanted-rose',
	'angelic-presence': 'angelic-presence',
};

const GALLERY_VARIANT_TO_ENTRYPOINT: Record<string, string> = {
	editorial: 'editorial',
	'editorial-rose': 'editorial-rose',
	'editorial-magazine': 'editorial-magazine',
	'premiere-floral': 'editorial',
	'celestial-blue': 'celestial-blue',
	'enchanted-rose': 'enchanted-rose',
	'sacred-keepsake': 'sacred-keepsake',
	'angelic-presence': 'angelic-presence',
	'luxury-hacienda': 'luxury-hacienda',
	'jewelry-box': 'jewelry-box',
	'jewelry-box-wedding': 'jewelry-box',
};

// Only presets with a dedicated footer/*.scss file go here.
// All other presets fall back to the bundle default footer.

export function buildSectionUrlMap(modules: Record<string, CssModule>): SectionUrlMap {
	const sectionUrlMap: SectionUrlMap = {};

	for (const [path, mod] of Object.entries(modules)) {
		const parts = path.split('/');
		const fileName = parts.at(-1);
		const sectionName = parts.at(-2);
		if (!fileName || !sectionName) continue;

		const entrypoint = fileName.replace(/^_/, '').replace(/\.scss$/, '');
		sectionUrlMap[sectionName] ??= {};
		sectionUrlMap[sectionName][entrypoint] = mod.default;
	}

	return sectionUrlMap;
}

export function buildSectionBundleUrlMap(modules: Record<string, CssModule>): SectionBundleUrlMap {
	const sectionBundleUrlMap: SectionBundleUrlMap = {};

	for (const [path, mod] of Object.entries(modules)) {
		const fileName = path.split('/').at(-1);
		if (!fileName) continue;

		const preset = fileName.replace(/\.scss$/, '');
		sectionBundleUrlMap[preset] = mod.default;
	}

	return sectionBundleUrlMap;
}

export const buildInvitationProfileUrlMap = buildSectionBundleUrlMap;

export function resolveSectionBundleCssUrl(
	sectionBundleUrlMap: SectionBundleUrlMap,
	preset: string,
): string | undefined {
	return sectionBundleUrlMap[preset];
}

export function resolveSectionCssUrl(
	sectionUrlMap: SectionUrlMap,
	section: string,
	presetToEntrypoint: Record<string, string>,
	preset: string,
): string | undefined {
	const entrypoint = presetToEntrypoint[preset];
	if (!entrypoint) return undefined;
	return sectionUrlMap[section]?.[entrypoint];
}

/** Resolve the canonical Gallery variant stylesheet independently of the theme bundle. */
export function resolveGalleryVariantCssUrl(
	sectionUrlMap: SectionUrlMap,
	variant: string,
): string | undefined {
	if (variant === 'single') return undefined;
	return resolveSectionCssUrl(sectionUrlMap, 'gallery', GALLERY_VARIANT_TO_ENTRYPOINT, variant);
}

/** @internal — re-exported for tests */
export function resolveSectionCssUrls(
	sectionUrlMap: SectionUrlMap,
	configs: SectionCssConfig[],
	preset: string,
): string[] {
	return configs.flatMap(({ section, presetToEntrypoint }) => {
		const url = resolveSectionCssUrl(sectionUrlMap, section, presetToEntrypoint, preset);
		return url ? [url] : [];
	});
}

export function resolveInvitationCssUrls(
	sectionBundleUrlMap: SectionBundleUrlMap,
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssInput,
	profileUrlMap: InvitationProfileUrlMap = {},
): string[] {
	const urls: string[] = [];
	const bundleUrl = resolveSectionBundleCssUrl(sectionBundleUrlMap, input.themePreset);
	if (bundleUrl) {
		urls.push(bundleUrl);
	}

	if (input.footerVariant && input.footerVariant !== input.themePreset) {
		const footerUrl = resolveSectionCssUrl(
			sectionUrlMap,
			'footer',
			FOOTER_PRESET_TO_ENTRYPOINT,
			input.footerVariant,
		);
		if (footerUrl) {
			urls.push(footerUrl);
		}
	}

	if (input.galleryVariant && input.galleryVariant !== input.themePreset) {
		const galleryUrl = resolveGalleryVariantCssUrl(sectionUrlMap, input.galleryVariant);
		if (galleryUrl) urls.push(galleryUrl);
	}

	const profileId = input.visualProfileId || input.slug;
	if (profileId) {
		const profileUrl = profileUrlMap[profileId];
		if (profileUrl) {
			urls.push(profileUrl);
		}
	}

	return [...new Set(urls)];
}
