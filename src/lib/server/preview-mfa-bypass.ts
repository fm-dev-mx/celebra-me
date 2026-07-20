/**
 * preview-mfa-bypass.ts — Strictly Guarded MFA Bypass for Preview Environment
 *
 * Provides a separate, more restrictive MFA bypass for the dedicated Preview
 * deployment on Vercel. Does NOT change DEV_MFA_BYPASS behavior.
 *
 * All conditions must be true for the bypass to activate:
 *   1. PREVIEW_MFA_BYPASS === 'true'
 *   2. VERCEL_ENV === 'preview'
 *   3. VERCEL_GIT_COMMIT_REF === 'develop'
 *   4. SUPABASE_URL matches the dedicated Preview Supabase project
 *   5. The authenticated user's role is 'super_admin'
 *   6. The authenticated email is allowlisted in PREVIEW_ADMIN_EMAILS
 *
 * Production (VERCEL_ENV=production) is always fail-closed even if every
 * Preview bypass variable is accidentally configured there.
 */

import { getEnv } from '@/lib/server/env';

export interface PreviewMfaBypassInput {
	previewMfaBypass: string | undefined;
	vercelEnv: string | undefined;
	vercelGitCommitRef: string | undefined;
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
		return hostname === `${PREVIEW_PROJECT_REF}.supabase.co` || hostname === `${PREVIEW_PROJECT_REF}.supabase.com`;
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
		vercelEnv: getEnv('VERCEL_ENV'),
		vercelGitCommitRef: getEnv('VERCEL_GIT_COMMIT_REF'),
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

	// 2. Must be a Vercel Preview deployment
	if (env.vercelEnv !== 'preview') return false;

	// 3. Must be from the develop branch
	if (env.vercelGitCommitRef !== 'develop') return false;

	// 4. SUPABASE_URL must match the dedicated Preview project
	if (!isPreviewSupabaseUrl(env.supabaseUrl)) return false;

	// 5. User must have super_admin role
	if (env.userRole !== 'super_admin') return false;

	// 6. Email must be allowlisted
	if (!isAllowlistedAdmin(env.userEmail, env.adminEmails)) return false;

	return true;
}

/**
 * Check whether the bypass would be active on Production even with all
 * variables set (fail-closed verification).
 */
export function isProductionWithPreviewBypassVarsSet(): boolean {
	const vercelEnv = getEnv('VERCEL_ENV');
	if (vercelEnv !== 'production') return false;

	// Production must remain fail-closed even if someone sets these vars
	const bypass = getEnv('PREVIEW_MFA_BYPASS');
	const branch = getEnv('VERCEL_GIT_COMMIT_REF');
	const emails = getEnv('PREVIEW_ADMIN_EMAILS');
	const supabaseUrl = getEnv('SUPABASE_URL');

	return bypass === 'true' || branch === 'develop' || !!emails || isPreviewSupabaseUrl(supabaseUrl);
}
