import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';

describe('resolveInvitationTheme', () => {
	test('returns the invitation themeId when it is a valid ThemePreset', () => {
		expect(resolveInvitationTheme({ themeId: 'celestial-blue' })).toBe('celestial-blue');
	});

	test('returns null when the themeId is not a known preset', () => {
		expect(resolveInvitationTheme({ themeId: 'nonexistent-theme' })).toBeNull();
	});
});
