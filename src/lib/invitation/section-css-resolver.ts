import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionUrlMap,
	buildSectionBundleUrlMap,
	buildInvitationProfileUrlMap,
	resolveInvitationCssUrls as resolveInvitationCssUrlsFromMaps,
	resolveSectionBundleCssUrl as resolveBundleCssUrl,
} from '@/lib/invitation/section-css-resolver-map';

const sectionModules = import.meta.glob('/src/styles/invitation-sections/**/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;
// Eager glob over a small directory (~dozen files, URLs only).
// If this directory grows significantly, consider lazy imports.

const sectionBundleModules = import.meta.glob('/src/styles/invitation-sections-by-preset/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const invitationProfileModules = import.meta.glob('/src/styles/invitation-profiles/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionUrlMap = buildSectionUrlMap(sectionModules);
const sectionBundleUrlMap = buildSectionBundleUrlMap(sectionBundleModules);
const invitationProfileUrlMap = buildInvitationProfileUrlMap(invitationProfileModules);

if (import.meta.env.DEV) {
	const map = new Map(Object.entries(sectionBundleUrlMap));
	for (const preset of THEME_PRESETS) {
		if (!map.has(preset)) {
			console.warn(
				`[section-css-resolver] Missing section bundle for preset "${preset}". No file found at src/styles/invitation-sections-by-preset/${preset}.scss.`,
			);
		}
	}
}

export function resolveSectionBundleCssUrl(preset: string): string | undefined {
	return resolveBundleCssUrl(sectionBundleUrlMap, preset);
}

export function resolveInvitationCssUrls(input: {
	themePreset: string;
	footerVariant?: string;
	visualProfileId?: string;
}): string[] {
	return resolveInvitationCssUrlsFromMaps(
		sectionBundleUrlMap,
		sectionUrlMap,
		input,
		invitationProfileUrlMap,
	);
}
