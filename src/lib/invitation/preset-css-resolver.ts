import { THEME_PRESETS } from '@/lib/theme/theme-contract';

const presetModules = import.meta.glob('/src/styles/invitation-presets/*.scss', {
	query: '?url',
	eager: true,
}) as Record<string, { default: string }>;

const presetUrlMap: Record<string, string> = {};
for (const [path, mod] of Object.entries(presetModules)) {
	const name =
		path
			.split('/')
			.pop()
			?.replace(/\.scss$/, '') ?? '';
	presetUrlMap[name] = mod.default;
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

export function resolvePresetCssUrl(preset: string): string {
	const url = presetUrlMap[preset];
	if (!url) throw new Error(`Missing preset stylesheet entrypoint for "${preset}".`);
	return url;
}
