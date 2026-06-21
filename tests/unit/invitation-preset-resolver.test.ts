import {
	resolveInvitationTheme,
	resolvePreviewSlug,
	checkPublishGuard,
} from '@/lib/intake/services/invitation-preset-resolver';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';
import type { DemoPreset } from '@/lib/intake/types';

const CELESTIAL_PRESET = DEMO_PRESET_CATALOG.find(
	(p) => p.id === 'demo-xv-celestial-blue',
) as DemoPreset;

// ----------------------------------------------------------------
// resolveInvitationTheme
// ----------------------------------------------------------------

describe('resolveInvitationTheme', () => {
	test('returns the themeId when it is a valid ThemePreset', () => {
		expect(
			resolveInvitationTheme({
				themeId: 'celestial-blue',
				baseDemoId: 'demo-xv-celestial-blue',
			}),
		).toBe('celestial-blue');
	});

	test('returns the catalog themeId when theme_id is invalid', () => {
		expect(
			resolveInvitationTheme({
				themeId: 'nonexistent-theme',
				baseDemoId: 'demo-xv-celestial-blue',
			}),
		).toBe('celestial-blue');
	});

	test('falls back to a valid ThemePreset when neither theme_id nor baseDemoId is resolvable', () => {
		const result = resolveInvitationTheme({
			themeId: 'bogus',
			baseDemoId: 'nonexistent-preset',
		});
		expect(THEME_PRESETS.includes(result)).toBe(true);
	});

	test('returns a valid theme even when theme_id diverges from snapshot', () => {
		expect(
			resolveInvitationTheme({
				themeId: 'celestial-blue',
				baseDemoId: 'demo-xv-celestial-blue',
			}),
		).toBe('celestial-blue');
	});
});

// ----------------------------------------------------------------
// resolvePreviewSlug
// ----------------------------------------------------------------

describe('resolvePreviewSlug', () => {
	test('uses catalog previewSlug when catalog entry exists', () => {
		const result = resolvePreviewSlug({
			baseDemoId: 'demo-xv-celestial-blue',
			snapshot: { ...CELESTIAL_PRESET, previewSlug: 'stale-slug' },
		});
		expect(result).toBe('demo-xv-celestial-blue');
	});

	test('falls back to snapshot previewSlug when catalog entry is missing', () => {
		const result = resolvePreviewSlug({
			baseDemoId: 'nonexistent',
			snapshot: { ...CELESTIAL_PRESET, previewSlug: 'custom-slug' },
		});
		expect(result).toBe('custom-slug');
	});

	test('returns empty string when neither catalog nor snapshot has a previewSlug', () => {
		const result = resolvePreviewSlug({
			baseDemoId: 'nonexistent',
			snapshot: { id: 'x', themeId: 'celestial-blue' } as DemoPreset,
		});
		expect(result).toBe('');
	});
});

// ----------------------------------------------------------------
// checkPublishGuard
// ----------------------------------------------------------------

describe('checkPublishGuard', () => {
	test('passes when theme is valid and matches the catalog', () => {
		const result = checkPublishGuard({
			themeId: 'celestial-blue',
			baseDemoId: 'demo-xv-celestial-blue',
		});
		expect(result).toEqual({ ok: true });
	});

	test('fails when theme_id is invalid', () => {
		const result = checkPublishGuard({
			themeId: 'not-a-real-theme',
			baseDemoId: 'demo-xv-celestial-blue',
		});
		expect(result.ok).toBe(false);
	});

	test('fails when theme_id does not match the catalog entry', () => {
		const result = checkPublishGuard({
			themeId: 'jewelry-box',
			baseDemoId: 'demo-xv-celestial-blue',
		});
		expect(result.ok).toBe(false);
	});
});
