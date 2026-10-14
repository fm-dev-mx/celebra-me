/**
 * preview-mfa-bypass.ts — Strictly Guarded MFA Bypass for Preview Environment
 *
 * Provides a separate, more restrictive MFA bypass for the dedicated Preview
 * deployment. Does NOT change DEV_MFA_BYPASS behavior.
 *
 * All conditions must be true for the bypass to activate:
 *   1. PREVIEW_MFA_BYPASS === 'true'
 *   2. The deploy identity is hosted Preview (CELEBRA_DEPLOY_ENV=preview)
 *   3. The build came from the develop branch (build-time git ref)
 *   4. SUPABASE_URL matches the dedicated Preview Supabase project
 *   5. The authenticated user's role is 'super_admin'
 *   6. The authenticated email is allowlisted in PREVIEW_ADMIN_EMAILS
 *
 * Production (CELEBRA_DEPLOY_ENV=production) is always fail-closed even if every
 * Preview bypass variable is accidentally configured there.
 */

import { readBuildIdentity } from '@/lib/environment';
import {
	readHostedDeployEnvironment,
	type HostedDeployEnvironment,
} from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

export interface PreviewMfaBypassInput {
	previewMfaBypass: string | undefined;
	deployEnvironment: HostedDeployEnvironment | null;
	buildRef: string | null;
	supabaseUrl: string | undefined;
	adminEmails: string | undefined;
	userEmail: string;
	userRole: string;
}

/**
 * The dedicated Preview Supabase project ref.
 * Only this exact project may activate the bypass.
 */
const PREVIEW_PROJECT_REF = 'iwipdvisoyerfdytuhwi';

function isPreviewSupabaseUrl(urlString: string | undefined): boolean {
	if (!urlString) return false;
	try {
		const url = new URL(urlString);
		if (url.protocol !== 'https:') return false;
		const hostname = url.hostname.toLowerCase();
		// Match the exact preview project host
		return (
			hostname === `${PREVIEW_PROJECT_REF}.supabase.co` ||
			hostname === `${PREVIEW_PROJECT_REF}.supabase.com`
		);
	} catch {
		return false;
	}
}

function isAllowlistedAdmin(email: string, adminEmails: string | undefined): boolean {
	if (!adminEmails) return false;
	const allowlist = adminEmails
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return allowlist.includes(email.trim().toLowerCase());
}

function readDefaultInput(userEmail?: string, userRole?: string): PreviewMfaBypassInput {
	return {
		previewMfaBypass: getEnv('PREVIEW_MFA_BYPASS'),
		deployEnvironment: readHostedDeployEnvironment(),
		buildRef: readBuildIdentity().gitRef,
		supabaseUrl: getEnv('SUPABASE_URL'),
		adminEmails: getEnv('PREVIEW_ADMIN_EMAILS'),
		userEmail: userEmail ?? '',
		userRole: userRole ?? '',
	};
}

export function isPreviewMfaBypassEnabled(
	input?: Partial<PreviewMfaBypassInput> & { userEmail: string; userRole: string },
): boolean {
	const env = { ...readDefaultInput(input?.userEmail, input?.userRole), ...input };

	// 1. Flag must be explicitly 'true'
	if (env.previewMfaBypass !== 'true') return false;

	// 2. Must be a hosted Preview deployment
	if (env.deployEnvironment !== 'preview') return false;

	// 3. Must be built from the develop branch
	if (env.buildRef !== 'develop') return false;

	// 4. SUPABASE_URL must match the dedicated Preview project
	if (!isPreviewSupabaseUrl(env.supabaseUrl)) return false;

	// 5. User must have super_admin role
	if (env.userRole !== 'super_admin') return false;

	// 6. Email must be allowlisted
	if (!isAllowlistedAdmin(env.userEmail, env.adminEmails)) return false;

	return true;
}
