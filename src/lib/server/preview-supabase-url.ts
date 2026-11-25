/**
 * Server-only helper to identify whether a Supabase URL points to the dedicated Preview project.
 *
 * Reusable across server contexts (e.g. dev MFA bypass and dashboard environment banner).
 * Strictly server-only: must never be imported by client islands.
 */

import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';

export function isPreviewSupabaseUrl(urlString: string | undefined): boolean {
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
