import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import type { Invitation } from '@/lib/intake/types';

const VALID_THEMES = new Set<string>(THEME_PRESETS);

export function resolveInvitationTheme(
	invitation: Pick<Invitation, 'themeId' | 'baseDemoId'>,
): ThemePreset {
	if (VALID_THEMES.has(invitation.themeId)) {
		return invitation.themeId as ThemePreset;
	}
	const entry = findDemoPreset(invitation.baseDemoId);
	return entry?.themeId ?? THEME_PRESETS[0];
}

export function resolvePreviewSlug(
	invitation: Pick<Invitation, 'baseDemoId' | 'snapshot'>,
): string {
	const entry = findDemoPreset(invitation.baseDemoId);
	return entry?.previewSlug ?? invitation.snapshot?.previewSlug ?? '';
}

export function checkPublishGuard(
	invitation: Pick<Invitation, 'themeId' | 'baseDemoId'>,
): { ok: true } | { ok: false; errors: string[] } {
	const errors: string[] = [];

	if (!VALID_THEMES.has(invitation.themeId)) {
		errors.push(
			`El tema configurado "${invitation.themeId}" no es un tema válido. Contacta a soporte para corregir la invitación.`,
		);
	}

	const catalogEntry = findDemoPreset(invitation.baseDemoId);
	if (catalogEntry && catalogEntry.themeId !== invitation.themeId) {
		errors.push(
			`El tema "${invitation.themeId}" no coincide con el tema "${catalogEntry.themeId}" del preset "${invitation.baseDemoId}". Revisa la configuración antes de publicar.`,
		);
	}

	if (errors.length > 0) return { ok: false, errors };
	return { ok: true };
}
