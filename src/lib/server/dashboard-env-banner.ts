/**
 * Dashboard environment banner resolution.
 *
 * Distinguishes Local Supabase, local Astro against Preview BD
 * (`CELEBRA_RUNTIME_TARGET=preview`), and hosted Preview.
 * Worktree path alone is never authorization.
 */

import type { DeployEnvironment } from '@/lib/server/deploy-identity';
import { isPreviewSupabaseUrl } from '@/lib/server/preview-supabase-url';

export interface DashboardEnvBannerInput {
	/** Resolved deploy identity; null when it is missing or invalid. */
	deployEnvironment: DeployEnvironment | null;
	celebraRuntimeTarget: string | undefined;
	supabaseUrl: string | undefined;
	previewMfaBypass: string | undefined;
}

type DashboardEnvBanner =
	| { kind: 'local'; label: string; className: string }
	| { kind: 'preview-db'; label: string; className: string }
	| { kind: 'hosted-preview'; label: string; className: string };

/**
 * Pure resolver for the non-production dashboard environment banner.
 * Returns null on Production and when the deploy identity is missing or invalid.
 */
export function resolveDashboardEnvBanner(
	input: DashboardEnvBannerInput,
): DashboardEnvBanner | null {
	if (input.deployEnvironment === 'preview') {
		const mfaOff = (input.previewMfaBypass ?? '').trim() === 'true';
		return {
			kind: 'hosted-preview',
			className: 'dashboard-env-banner--preview',
			label: mfaOff ? '⚠️ ENTORNO PREVIEW — MFA desactivado' : '⚠️ ENTORNO PREVIEW',
		};
	}

	if (input.deployEnvironment !== 'local') return null;

	const target = (input.celebraRuntimeTarget ?? '').trim().toLowerCase();
	if (target === 'preview' && isPreviewSupabaseUrl(input.supabaseUrl)) {
		return {
			kind: 'preview-db',
			className: 'dashboard-env-banner--preview',
			label: '🧪 BD PREVIEW',
		};
	}

	return {
		kind: 'local',
		className: 'dashboard-env-banner--local',
		label: '🧪 ENTORNO LOCAL',
	};
}
