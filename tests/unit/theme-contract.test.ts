import fs from 'node:fs';
import path from 'node:path';
import {
	EVENT_TYPES,
	THEME_PRESETS,
	PORTRAIT_SUPPORTED_THEMES,
	listThemePresetsForEventType,
	themeSupportsPortrait,
} from '@/lib/theme/theme-contract';

function entrypointNames(dir: string): string[] {
	return fs
		.readdirSync(path.join(process.cwd(), dir))
		.filter((file) => file.endsWith('.scss'))
		.map((file) => file.replace(/\.scss$/, ''))
		.sort();
}

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

describe('THEME_PRESET_METADATA', () => {
	it.each(['src/styles/invitation-presets', 'src/styles/invitation-sections-by-preset'])(
		'%s has exactly one entrypoint per preset',
		(dir) => {
			expect(entrypointNames(dir)).toEqual([...THEME_PRESETS].sort());
		},
	);

	it('gives every preset at least one event type and every event type a preset', () => {
		const covered = new Set(EVENT_TYPES.flatMap((type) => listThemePresetsForEventType(type)));
		expect([...covered].sort()).toEqual([...THEME_PRESETS].sort());
		for (const type of EVENT_TYPES)
			expect(listThemePresetsForEventType(type).length).toBeGreaterThan(0);
	});
});
