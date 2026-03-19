import type { ThemePreset } from './theme-contract';

export const COLOR_TOKENS = {
	surfacePrimary: 'surfacePrimary',
	actionPrimary: 'actionPrimary',
	actionAccent: 'actionAccent',
	surfaceDark: 'surfaceDark',
	surfaceSoft: 'surfaceSoft',
	primary: 'primary',
	accent: 'accent',
	background: 'background',
} as const;

export type ColorToken = (typeof COLOR_TOKENS)[keyof typeof COLOR_TOKENS];
export const VALID_COLOR_TOKENS = Object.values(COLOR_TOKENS) as string[];

export const PRESET_COLOR_MAP: Record<ThemePreset, Record<string, string>> = {
	'top-premium-floral': {
		surfacePrimary: '#FBEDED',
		actionPrimary: '#D4A5A5',
		surfaceDark: '#5E4B4B',
		surfaceSoft: '#FFFFFF',
		primary: '#FBEDED', // Legacy/Default theme primary
		accent: '#D4A5A5', // Legacy/Default theme accent
		background: '#FBEDED',
	},
	'jewelry-box': {
		surfacePrimary: '#FDF7F2',
		actionPrimary: '#1B2735',
		actionAccent: '#D4AF37',
		surfaceDark: '#1B2735',
		surfaceSoft: '#FFFFFF',
		primary: '#FDF7F2',
		accent: '#D4AF37',
		background: '#FDF7F2',
	},
	'jewelry-box-wedding': {
		surfacePrimary: '#fefcf9',
		actionPrimary: '#333333',
		actionAccent: '#e5c387',
		surfaceDark: '#333333',
		surfaceSoft: '#fdfbf7',
		primary: '#fefcf9',
		accent: '#e5c387',
		background: '#fefcf9',
	},
	'luxury-hacienda': {
		surfacePrimary: '#F5F5F5',
		actionPrimary: '#5D4037',
		actionAccent: '#C5A028',
		surfaceDark: '#2C1E12',
		surfaceSoft: '#FFFFFF',
		primary: '#2C1E12',
		accent: '#C5A028',
		background: '#F5F5F5',
	},
	editorial: {
		surfacePrimary: '#FFFFFF',
		actionPrimary: '#111111',
		actionAccent: '#D4AF37',
		surfaceDark: '#111111',
		surfaceSoft: '#FFFFFF',
		primary: '#FFFFFF',
		accent: '#111111',
		background: '#FFFFFF',
	},
};

/**
 * Resolves a color token or hex string to a hex string for a given preset.
 */
export function resolveColorToken(
	color: string,
	preset: ThemePreset,
	fallback: string = '#000000',
): string {
	if (color.startsWith('#')) return color;

	const token = color;

	const presetMap = PRESET_COLOR_MAP[preset] || PRESET_COLOR_MAP['jewelry-box'];
	if (token in presetMap) {
		return presetMap[token];
	}

	// Semantic fallbacks
	if (token === 'primary') return presetMap.surfacePrimary || presetMap.primary;
	if (token === 'accent') return presetMap.actionPrimary || presetMap.accent;
	if (token === 'background') return presetMap.surfacePrimary || presetMap.background;

	return fallback;
}
