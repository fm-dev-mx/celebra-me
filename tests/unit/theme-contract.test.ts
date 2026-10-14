import {
	THEME_PRESETS,
	PORTRAIT_SUPPORTED_THEMES,
	themeSupportsPortrait,
} from '@/lib/theme/theme-contract';

describe('themeSupportsPortrait', () => {
	it('includes editorial-magazine as a portrait-capable preset', () => {
		expect(THEME_PRESETS as readonly string[]).toContain('editorial-magazine');
		expect(themeSupportsPortrait('editorial-magazine')).toBe(true);
	});

	it('returns false for an unknown theme', () => {
		expect(themeSupportsPortrait('nonexistent-theme')).toBe(false);
	});

	it('answers for every theme from the supported set alone', () => {
		for (const theme of THEME_PRESETS) {
			expect(themeSupportsPortrait(theme)).toBe(PORTRAIT_SUPPORTED_THEMES.has(theme));
		}
	});

	it('returns true for themes that render portrait in CSS (editorial, premiere-floral, sacred-keepsake, angelic-presence)', () => {
		expect(themeSupportsPortrait('editorial')).toBe(true);
		expect(themeSupportsPortrait('premiere-floral')).toBe(true);
		expect(themeSupportsPortrait('sacred-keepsake')).toBe(true);
		expect(themeSupportsPortrait('angelic-presence')).toBe(true);
	});

	it('returns false for themes that hide portrait via display:none (celestial-blue, enchanted-rose)', () => {
		expect(themeSupportsPortrait('celestial-blue')).toBe(false);
		expect(themeSupportsPortrait('enchanted-rose')).toBe(false);
	});

	it('every theme in PORTRAIT_SUPPORTED_THEMES is a valid ThemePreset', () => {
		const valid = new Set(THEME_PRESETS);
		for (const theme of PORTRAIT_SUPPORTED_THEMES) {
			expect(valid.has(theme)).toBe(true);
		}
	});
});
