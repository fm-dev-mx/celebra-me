import type { ThemePreset } from './theme-contract';

export const COLOR_TOKENS = {
	surfacePrimary: 'surfacePrimary',
	actionPrimary: 'actionPrimary',
	actionAccent: 'actionAccent',
	surfaceDark: 'surfaceDark',
	surfaceSoft: 'surfaceSoft',
	textPrimary: 'textPrimary',
	primary: 'primary',
	accent: 'accent',
	background: 'background',
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
		primary: '#FBEDED', // Legacy/Default theme primary
		accent: '#D4A5A5', // Legacy/Default theme accent
		background: '#FBEDED',
	},
	'premiere-ivory-gold': {
		surfacePrimary: '#FCF7F0',
		actionPrimary: '#D0B075',
		actionAccent: '#B8914D',
		surfaceDark: '#5B4F43',
		surfaceSoft: '#FFFFFF',
		textPrimary: '#5B4F43',
		primary: '#FCF7F0',
		accent: '#B8914D',
		background: '#FCF7F0',
	},
	'premiere-sage-gold': {
		surfacePrimary: '#F5F3EC',
		actionPrimary: '#A8B09A',
		actionAccent: '#BA9A58',
		surfaceDark: '#4E574B',
		surfaceSoft: '#FFFFFF',
		textPrimary: '#4E574B',
		primary: '#F5F3EC',
		accent: '#BA9A58',
		background: '#F5F3EC',
	},
	'premiere-rose-plum': {
		surfacePrimary: '#F9EEF2',
		actionPrimary: '#B98D9E',
		actionAccent: '#7A5A6C',
		surfaceDark: '#5C4654',
		surfaceSoft: '#FFFDFE',
		textPrimary: '#5C4654',
		primary: '#F9EEF2',
		accent: '#7A5A6C',
		background: '#F9EEF2',
	},
	'jewelry-box': {
		surfacePrimary: '#FDF7F2',
		actionPrimary: '#1B2735',
		actionAccent: '#D4AF37',
		surfaceDark: '#1B2735',
		surfaceSoft: '#FFFFFF',
		textPrimary: '#1B2735',
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
		textPrimary: '#333333',
		primary: '#fefcf9',
		accent: '#e5c387',
		background: '#fefcf9',
	},
	'luxury-hacienda': {
		surfacePrimary: '#F5F5DC', // Matches $base-parchment-100
		actionPrimary: '#2C1E12', // Matches $base-coffee-900
		actionAccent: '#C5A028',
		surfaceDark: '#2C1E12',
		surfaceElevated: '#3D2B1E', // Added for contrast in reveal/panels
		surfaceSoft: '#FFFFFF',
		textPrimary: '#2C1E12',
		primary: '#F5F5DC', // ALIGNED TO SURFACE
		accent: '#C5A028',
		background: '#F5F5DC',
	},
	editorial: {
		surfacePrimary: '#050505',
		actionPrimary: '#F9F6F2',
		actionAccent: '#D4AF37',
		surfaceDark: '#0D0D0D',
		surfaceSoft: '#1A1A1A',
		textPrimary: '#F9F6F2',
		primary: '#050505', // ALIGNED TO SURFACE
		accent: '#D4AF37',
		background: '#050505',
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
