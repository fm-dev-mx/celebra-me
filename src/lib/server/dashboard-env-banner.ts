/**
 * Dashboard environment banner resolution.
 *
 * Distinguishes Local Supabase, local Astro against Preview BD
 * (`CELEBRA_RUNTIME_TARGET=preview`), and hosted Vercel Preview.
 * Worktree path alone is never authorization.
 */

import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';

export interface DashboardEnvBannerInput {
	vercelEnv: string | undefined;
	celebraRuntimeTarget: string | undefined;
	supabaseUrl: string | undefined;
	previewMfaBypass: string | undefined;
}

type DashboardEnvBanner =
	| { kind: 'local'; label: string; className: string }
	| { kind: 'preview-db'; label: string; className: string }
	| { kind: 'vercel-preview'; label: string; className: string };

function isPreviewSupabaseUrl(urlString: string | undefined): boolean {
	if (!urlString) return false;
	try {
		const url = new URL(urlString);
		if (url.protocol !== 'https:' || url.username || url.password) return false;
		const hostname = url.hostname.toLowerCase();
		const ref = SUPABASE_PROJECT_REFS.preview;
		return hostname === `${ref}.supabase.co` || hostname === `${ref}.supabase.com`;
	} catch {
		return false;
	}
}

function isLocalProcess(vercelEnv: string): boolean {
	return vercelEnv === '' || vercelEnv === 'development';
}

/**
 * Pure resolver for the non-production dashboard environment banner.
 * Returns null on Production or unknown deployed environments.
 */
export function resolveDashboardEnvBanner(
	input: DashboardEnvBannerInput,
): DashboardEnvBanner | null {
	const vercelEnv = (input.vercelEnv ?? '').trim().toLowerCase();

	if (vercelEnv === 'production') return null;

	if (vercelEnv === 'preview') {
		const mfaOff = (input.previewMfaBypass ?? '').trim() === 'true';
		return {
			kind: 'vercel-preview',
			className: 'dashboard-env-banner--preview',
			label: mfaOff ? '⚠️ ENTORNO PREVIEW — MFA desactivado' : '⚠️ ENTORNO PREVIEW',
		};
	}

	if (!isLocalProcess(vercelEnv)) return null;

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
