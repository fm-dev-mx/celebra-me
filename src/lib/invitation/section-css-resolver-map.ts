import { resolveInvitationProfileCssUrl } from './invitation-profile-css';
import { CANONICAL_VARIANT_REGISTRY } from './section-variants';

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
	sectionVariants?: {
		hero?: string;
		thankYou?: string;
		gifts?: string;
		rsvp?: string;
		personalizedAccess?: string;
		family?: string;
		location?: string;
		itinerary?: string;
		countdown?: string;
	};
	envelopeVariant?: string;
	visualProfileId?: string;
	slug?: string;
};

export type InvitationCssOwner =
	| 'section-bundle'
	| 'footer-variant'
	| 'gallery-variant'
	| 'envelope-reveal'
	| 'section-variant'
	| 'visual-profile';

export interface InvitationCssLoadItem {
	href: string;
	owner: InvitationCssOwner;
	/** True when the sheet is required to paint the sealed envelope or hero structural CSS. */
	blocking: boolean;
}

// Only presets with a dedicated footer/*.scss file go here.
// All other presets fall back to the bundle default footer.
const FOOTER_PRESET_TO_ENTRYPOINT: Record<string, string> = {
	editorial: 'editorial',
	'premiere-floral': 'premiere-floral',
	'enchanted-rose': 'enchanted-rose',
	'angelic-presence': 'angelic-presence',
};

function entrypointFromCssOwner(cssOwner: string): string | undefined {
	if (!cssOwner.startsWith('src/styles/')) return undefined;
	return cssOwner.split('/').at(-1)?.replace(/^_/, '').replace(/\.scss$/u, '');
}

const GALLERY_VARIANT_TO_ENTRYPOINT: Record<string, string> = Object.fromEntries(
	CANONICAL_VARIANT_REGISTRY.filter((entry) => entry.section === 'gallery')
		.map((entry) => [entry.variant, entrypointFromCssOwner(entry.cssOwner)])
		.filter((entry): entry is [string, string] => Boolean(entry[1])),
);

const ENVELOPE_VARIANT_TO_ENTRYPOINT: Record<string, string> = {
	'premiere-floral': 'premiere-floral',
	editorial: 'editorial',
	'luxury-hacienda': 'luxury-hacienda',
	'jewelry-box': 'shared-light',
	'jewelry-box-wedding': 'shared-light',
	'celestial-blue': 'shared-light',
	'enchanted-rose': 'shared-light',
};

const SECTION_VARIANT_TO_ENTRYPOINT: Record<string, Record<string, string>> =
	CANONICAL_VARIANT_REGISTRY.filter((entry) => entry.section !== 'gallery')
		.map((entry) => [entry.section, entry.variant, entrypointFromCssOwner(entry.cssOwner)])
		.filter((entry): entry is [string, string, string] => Boolean(entry[2]))
		.reduce<Record<string, Record<string, string>>>((result, [section, variant, entrypoint]) => {
			(result[section] ??= {})[variant] = entrypoint;
			return result;
		}, {});

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

function resolveSectionVariantLoadItems(
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssInput,
): InvitationCssLoadItem[] {
	return Object.entries(input.sectionVariants ?? {}).flatMap(([section, variant]) => {
		if (!variant) return [];
	const entrypoint = SECTION_VARIANT_TO_ENTRYPOINT[section]?.[variant];
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
		if (!url) return [];
		return [
			{
				href: url,
			owner: 'section-variant' as const,
				blocking: section === 'hero',
			},
		];
	});
}

export function resolveInvitationCssLoadPlan(
	sectionBundleUrlMap: SectionBundleUrlMap,
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssInput,
	profileUrlMap: InvitationProfileUrlMap = {},
): InvitationCssLoadItem[] {
	const items: InvitationCssLoadItem[] = [];
	const seen = new Set<string>();
	const push = (item: InvitationCssLoadItem | undefined) => {
		if (!item?.href || seen.has(item.href)) return;
		seen.add(item.href);
		items.push(item);
	};

	const bundleUrl = resolveSectionBundleCssUrl(sectionBundleUrlMap, input.themePreset);
	push(bundleUrl ? { href: bundleUrl, owner: 'section-bundle', blocking: false } : undefined);

	if (input.footerVariant && input.footerVariant !== input.themePreset) {
		const footerUrl = resolveSectionCssUrl(
			sectionUrlMap,
			'footer',
			FOOTER_PRESET_TO_ENTRYPOINT,
			input.footerVariant,
		);
		push(footerUrl ? { href: footerUrl, owner: 'footer-variant', blocking: false } : undefined);
	}

	if (input.galleryVariant && input.galleryVariant !== input.themePreset) {
		const galleryUrl = resolveGalleryVariantCssUrl(sectionUrlMap, input.galleryVariant);
		const galleryEntrypoint = GALLERY_VARIANT_TO_ENTRYPOINT[input.galleryVariant];
		if (galleryUrl && galleryEntrypoint !== input.themePreset) {
			push({ href: galleryUrl, owner: 'gallery-variant', blocking: false });
		}
	}

	if (input.envelopeVariant) {
		const revealUrl = resolveSectionCssUrl(
			sectionUrlMap,
			'reveal',
			ENVELOPE_VARIANT_TO_ENTRYPOINT,
			input.envelopeVariant,
		);
		push(revealUrl ? { href: revealUrl, owner: 'envelope-reveal', blocking: true } : undefined);
	}

	for (const item of resolveSectionVariantLoadItems(sectionUrlMap, input)) {
		push(item);
	}

	const profileUrl = resolveInvitationProfileCssUrl(profileUrlMap, input);
	push(profileUrl ? { href: profileUrl, owner: 'visual-profile', blocking: true } : undefined);

	return items;
}

export function resolveInvitationCssUrls(
	sectionBundleUrlMap: SectionBundleUrlMap,
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssInput,
	profileUrlMap: InvitationProfileUrlMap = {},
): string[] {
	return resolveInvitationCssLoadPlan(
		sectionBundleUrlMap,
		sectionUrlMap,
		input,
		profileUrlMap,
	).map((item) => item.href);
}
