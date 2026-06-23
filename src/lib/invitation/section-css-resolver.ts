import { THEME_PRESETS } from '@/lib/theme/theme-contract';

const sectionModules = import.meta.glob('/src/styles/invitation-sections/**/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const sectionUrlMap: Record<string, string> = {};
for (const [path, mod] of Object.entries(sectionModules)) {
	const name =
		path
			.split('/')
			.pop()
			?.replace(/\.scss$/, '') ?? '';
	sectionUrlMap[name] = mod.default;
}

const galleryPresetToEntrypoint: Record<string, string> = {
	'jewelry-box': 'jewelry-box',
	'luxury-hacienda': 'luxury-hacienda',
	'premiere-floral': 'editorial',
	editorial: 'editorial',
	'celestial-blue': 'celestial-blue',
	'enchanted-rose': 'enchanted-rose',
	'sacred-keepsake': 'sacred-keepsake',
	'angelic-presence': 'angelic-presence',
};

if (import.meta.env.DEV) {
	for (const preset of THEME_PRESETS) {
		if (!galleryPresetToEntrypoint[preset]) {
			console.warn(
				`[section-css-resolver] No gallery entrypoint for preset "${preset}". Gallery will render with base styles only.`,
			);
		}
	}
}

export function resolveGallerySectionCssUrl(preset: string): string | undefined {
	const entrypoint = galleryPresetToEntrypoint[preset];
	if (!entrypoint) return undefined;
	return sectionUrlMap[entrypoint];
}
