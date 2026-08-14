import { resolveInvitationProfileCssUrl } from './invitation-profile-css';

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
	structuralVariants?: {
		hero?: string;
		thankYou?: string;
		gifts?: string;
		rsvp?: string;
		personalizedAccess?: string;
		family?: string;
		location?: string;
		itinerary?: string;
	};
	envelopeVariant?: string;
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
	'editorial-mosaic': 'editorial-mosaic',
	'magazine-spread': 'magazine-spread',
	'feature-mosaic': 'feature-mosaic',
	'feature-stack': 'feature-stack',
	'paired-feature-band': 'paired-feature-band',
	'index-choreography': 'index-choreography',
};

const ENVELOPE_VARIANT_TO_ENTRYPOINT: Record<string, string> = {
	'premiere-floral': 'premiere-floral',
};

const STRUCTURAL_VARIANT_TO_ENTRYPOINT: Record<string, Record<string, string>> = {
	hero: {
		'editorial-cover': 'editorial-cover',
		'split-cover': 'split-cover',
	},
	thankYou: {
		// editorial-back-cover selects shared editorial DOM. Theme bundles own
		// thank-you editorial geometry; a global structural load would override
		// those layouts.
		'full-bleed-photo': 'full-bleed-photo',
	},
	gifts: { 'editorial-catalog': 'editorial-catalog' },
	rsvp: { 'editorial-press-pass': 'editorial-press-pass' },
	personalizedAccess: { 'editorial-pass': 'editorial-pass' },
	family: {
		'split-groups': 'split-groups',
		'asymmetric-groups': 'asymmetric-groups',
	},
	location: {
		'split-map': 'split-map',
		'stacked-venue-plates': 'stacked-venue-plates',
	},
	itinerary: {
		'timeline-paper': 'timeline-paper',
		'editorial-ledger': 'editorial-ledger',
		'editorial-program': 'editorial-program',
	},
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

function resolveStructuralVariantCssUrls(
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssInput,
): string[] {
	return Object.entries(input.structuralVariants ?? {}).flatMap(([section, variant]) => {
		if (!variant) return [];
		const entrypoint = STRUCTURAL_VARIANT_TO_ENTRYPOINT[section]?.[variant];
		if (!entrypoint) return [];
		const sectionName =
			section === 'personalizedAccess'
				? 'personalized-access'
				: section === 'thankYou'
					? 'thank-you'
					: section;
		const url = resolveSectionCssUrl(
			sectionUrlMap,
			sectionName,
			{ [variant]: entrypoint },
			variant,
		);
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
		const galleryEntrypoint = GALLERY_VARIANT_TO_ENTRYPOINT[input.galleryVariant];
		if (galleryUrl && galleryEntrypoint !== input.themePreset) urls.push(galleryUrl);
	}

	if (input.envelopeVariant && input.envelopeVariant !== input.themePreset) {
		const revealUrl = resolveSectionCssUrl(
			sectionUrlMap,
			'reveal',
			ENVELOPE_VARIANT_TO_ENTRYPOINT,
			input.envelopeVariant,
		);
		if (revealUrl) urls.push(revealUrl);
	}

	urls.push(...resolveStructuralVariantCssUrls(sectionUrlMap, input));

	const profileUrl = resolveInvitationProfileCssUrl(profileUrlMap, input);
	if (profileUrl) {
		urls.push(profileUrl);
	}

	return [...new Set(urls)];
}
