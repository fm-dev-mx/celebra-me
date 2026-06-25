import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import {
	buildSectionBundleUrlMap,
	resolveSectionBundleCssUrl as resolveBundleCssUrl,
} from '@/lib/invitation/section-css-resolver-map';

const sectionBundleModules = import.meta.glob('/src/styles/invitation-sections-by-preset/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionBundleUrlMap = buildSectionBundleUrlMap(sectionBundleModules);

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
