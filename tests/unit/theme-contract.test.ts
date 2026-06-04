import {
	THEME_PRESETS,
	PORTRAIT_SUPPORTED_THEMES,
	PORTRAIT_HIDDEN_THEMES,
	themeSupportsPortrait,
} from '@/lib/theme/theme-contract';

describe('themeSupportsPortrait', () => {
	it('returns false for an unknown theme', () => {
		expect(themeSupportsPortrait('nonexistent-theme')).toBe(false);
	});

	it('covers every theme — supported vs hidden — in parity with CSS', () => {
		for (const theme of THEME_PRESETS) {
			if (PORTRAIT_HIDDEN_THEMES.has(theme)) {
				expect(themeSupportsPortrait(theme)).toBe(false);
			} else {
				expect(themeSupportsPortrait(theme)).toBe(true);
			}
		}
	});

	it('every theme in PORTRAIT_SUPPORTED_THEMES is a valid ThemePreset', () => {
		const valid = new Set(THEME_PRESETS);
		for (const theme of PORTRAIT_SUPPORTED_THEMES) {
			expect(valid.has(theme)).toBe(true);
		}
	});

	it('every theme in PORTRAIT_HIDDEN_THEMES is a valid ThemePreset', () => {
		const valid = new Set(THEME_PRESETS);
		for (const theme of PORTRAIT_HIDDEN_THEMES) {
			expect(valid.has(theme)).toBe(true);
		}
	});

	it('PORTRAIT_SUPPORTED_THEMES and PORTRAIT_HIDDEN_THEMES partition THEME_PRESETS exactly', () => {
		const union = new Set([...PORTRAIT_SUPPORTED_THEMES, ...PORTRAIT_HIDDEN_THEMES]);
		expect(union.size).toBe(THEME_PRESETS.length);

		const intersection = [...PORTRAIT_SUPPORTED_THEMES].filter((t) =>
			PORTRAIT_HIDDEN_THEMES.has(t),
		);
		expect(intersection).toEqual([]);
	});
});
