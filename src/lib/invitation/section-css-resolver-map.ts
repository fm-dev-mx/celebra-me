import { resolveInvitationProfileCssUrl } from './invitation-profile-css';
import { CANONICAL_VARIANT_REGISTRY } from './section-variants';

type CssModule = { default: string };

export type SectionUrlMap = Record<string, Record<string, string>> & {
	/** Exact source path to emitted URL for canonical variant ownership. */
	readonly __canonicalPaths?: Readonly<Record<string, string>>;
};
export type SectionBundleUrlMap = Record<string, string>;
export type InvitationProfileUrlMap = Record<string, string>;

type SectionCssConfig = {
	section: string;
	presetToEntrypoint: Record<string, string>;
};

export type InvitationCssResolverInput = {
	themePreset: string;
	footerVariant?: string;
	sectionVariants?: {
		hero?: string;
		thankYou?: string;
		gifts?: string;
		rsvp?: string;
		personalizedAccess?: string;
		family?: string;
		location?: string;
		itinerary?: string;
		gallery?: string;
		countdown?: string;
	};
	envelopeVariant?: string;
	visualProfileId?: string;
	slug?: string;
};

export type InvitationCssOwner =
	| 'section-bundle'
	| 'footer-variant'
	| 'envelope-reveal'
	| 'section-variant'
	| 'visual-profile';

export interface InvitationCssLoadItem {
	href: string;
	owner: InvitationCssOwner;
	/** True when the sheet is required to paint the sealed envelope or hero structural CSS. */
	blocking: boolean;
	/** Canonical source path when this item owns a section variant. */
	canonicalPath?: string;
}

// Only presets with a dedicated footer/*.scss file go here.
// All other presets fall back to the bundle default footer.
const FOOTER_PRESET_TO_ENTRYPOINT: Record<string, string> = {
	editorial: 'editorial',
	'premiere-floral': 'premiere-floral',
	'enchanted-rose': 'enchanted-rose',
	'angelic-presence': 'angelic-presence',
};

const ENVELOPE_VARIANT_TO_ENTRYPOINT: Record<string, string> = {
	'premiere-floral': 'premiere-floral',
	editorial: 'editorial',
	'luxury-hacienda': 'luxury-hacienda',
	'jewelry-box': 'shared-light',
	'jewelry-box-wedding': 'shared-light',
	'celestial-blue': 'shared-light',
	'enchanted-rose': 'shared-light',
};

export function buildSectionUrlMap(modules: Record<string, CssModule>): SectionUrlMap {
	const sectionUrlMap: SectionUrlMap = {};
	const canonicalPaths: Record<string, string> = {};

	for (const [path, mod] of Object.entries(modules)) {
		const parts = path.split('/');
		const fileName = parts.at(-1);
		const sectionName = parts.at(-2);
		if (!fileName || !sectionName) continue;

		const entrypoint = fileName.replace(/^_/, '').replace(/\.scss$/, '');
		sectionUrlMap[sectionName] ??= {};
		sectionUrlMap[sectionName][entrypoint] = mod.default;
		canonicalPaths[path.replace(/^\/+/, '')] = mod.default;
	}

	Object.defineProperty(sectionUrlMap, '__canonicalPaths', {
		value: canonicalPaths,
		enumerable: false,
		writable: false,
	});
	return sectionUrlMap;
}

export function mergeSectionUrlMaps(...maps: readonly SectionUrlMap[]): SectionUrlMap {
	const merged: SectionUrlMap = {};
	const canonicalPaths: Record<string, string> = {};
	for (const map of maps) {
		for (const [section, entries] of Object.entries(map)) {
			if (section === '__canonicalPaths') continue;
			merged[section] = { ...merged[section], ...entries };
		}
		Object.assign(canonicalPaths, map.__canonicalPaths ?? {});
	}
	Object.defineProperty(merged, '__canonicalPaths', {
		value: canonicalPaths,
		enumerable: false,
		writable: false,
	});
	return merged;
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
	input: InvitationCssResolverInput,
): InvitationCssLoadItem[] {
	return Object.entries(input.sectionVariants ?? {}).flatMap(([section, variant]) => {
		if (!variant) return [];
		const entry = CANONICAL_VARIANT_REGISTRY.find(
			(candidate) => candidate.section === section && candidate.variant === variant,
		);
		if (!entry) {
			throw new Error(`Unknown canonical section variant: ${section}.${variant}`);
		}
		if (entry.cssOwner.startsWith('section-base:')) return [];
		const exactUrl = sectionUrlMap.__canonicalPaths?.[entry.cssOwner];
		if (!exactUrl) {
			throw new Error(`Missing CSS delivery for ${section}.${variant}: ${entry.cssOwner}`);
		}
		return [
			{
				href: exactUrl,
				owner: 'section-variant' as const,
				blocking: section === 'hero',
				canonicalPath: entry.cssOwner,
			},
		];
	});
}

export function resolveInvitationCssLoadPlan(
	sectionBundleUrlMap: SectionBundleUrlMap,
	sectionUrlMap: SectionUrlMap,
	input: InvitationCssResolverInput,
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
	input: InvitationCssResolverInput,
	profileUrlMap: InvitationProfileUrlMap = {},
): string[] {
	return resolveInvitationCssLoadPlan(
		sectionBundleUrlMap,
		sectionUrlMap,
		input,
		profileUrlMap,
	).map((item) => item.href);
}
