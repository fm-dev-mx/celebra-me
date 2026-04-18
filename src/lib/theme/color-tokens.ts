import type { ThemePreset } from './theme-contract';

export const COLOR_TOKENS = {
	surfacePrimary: 'surfacePrimary',
	actionPrimary: 'actionPrimary',
	actionAccent: 'actionAccent',
	surfaceDark: 'surfaceDark',
	surfaceSoft: 'surfaceSoft',
	textPrimary: 'textPrimary',
} as const;

export type ColorToken = (typeof COLOR_TOKENS)[keyof typeof COLOR_TOKENS];
export const VALID_COLOR_TOKENS = Object.values(COLOR_TOKENS) as string[];

export const PRESET_COLOR_MAP: Record<ThemePreset, Record<string, string>> = {
	'premiere-floral': {
		surfacePrimary: '#FBEDED',
		actionPrimary: '#D4A5A5',
		actionAccent: '#D4A5A5',
		surfaceDark: '#5E4B4B',
		surfaceSoft: '#FFFFFF',
		textPrimary: '#5E4B4B',
	},
	'jewelry-box': {
		surfacePrimary: '#FDF7F2',
		actionPrimary: '#1B2735',
		actionAccent: '#D4AF37',
		surfaceDark: '#1B2735',
		surfaceSoft: '#FFFFFF',
		textPrimary: '#1B2735',
	},
	'jewelry-box-wedding': {
		surfacePrimary: '#fefcf9',
		actionPrimary: '#333333',
		actionAccent: '#e5c387',
		surfaceDark: '#333333',
		surfaceSoft: '#fdfbf7',
		textPrimary: '#333333',
	},
	'luxury-hacienda': {
		surfacePrimary: '#F5F5DC', // Matches $base-parchment-100
		actionPrimary: '#2C1E12', // Matches $base-coffee-900
		actionAccent: '#C5A028',
		surfaceDark: '#2C1E12',
		surfaceElevated: '#3D2B1E', // Added for contrast in reveal/panels
		surfaceSoft: '#FFFFFF',
		textPrimary: '#2C1E12',
	},
	editorial: {
		surfacePrimary: '#050505',
		actionPrimary: '#F9F6F2',
		actionAccent: '#D4AF37',
		surfaceDark: '#0D0D0D',
		surfaceSoft: '#1A1A1A',
		textPrimary: '#F9F6F2',
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

	return fallback;
}
