import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import type { Invitation } from '@/lib/intake/types';

const VALID_THEMES = new Set<string>(THEME_PRESETS);

/** The invitation's own theme preset, or null when it is not a known preset. */
export function resolveInvitationTheme(
	invitation: Pick<Invitation, 'themeId'>,
): ThemePreset | null {
	return VALID_THEMES.has(invitation.themeId) ? (invitation.themeId as ThemePreset) : null;
}
