import { THEME_PRESETS } from '@/lib/theme/theme-contract';

const FALLBACK_PRESET = 'jewelry-box';

const presetModules = import.meta.glob('/src/styles/invitation-presets/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, string>;

const presetUrlMap: Record<string, string> = {};
for (const [path, url] of Object.entries(presetModules)) {
	const name =
		path
			.split('/')
			.pop()
			?.replace(/\.scss$/, '') ?? '';
	presetUrlMap[name] = url;
}

if (import.meta.env.DEV) {
	for (const preset of THEME_PRESETS) {
		if (!presetUrlMap[preset]) {
			console.warn(
				`[preset-css-resolver] Missing entrypoint for preset "${preset}". No file found at src/styles/invitation-presets/${preset}.scss.`,
			);
		}
	}
}

export function resolvePresetCssUrl(preset: string): string | undefined {
	return presetUrlMap[preset] ?? presetUrlMap[FALLBACK_PRESET];
}
