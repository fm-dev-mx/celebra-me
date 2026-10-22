import { isDevEnvironment } from '@/lib/environment';
import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import { isLocalProcess, isLocalSupabaseUrl } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

export interface DevMfaBypassInput {
	devMfaBypass: string | undefined;
	/** Build-time `import.meta.env.DEV`: only the Astro dev server qualifies. */
	isDevServer: boolean;
	supabaseUrl: string | undefined;
	celebraRuntimeTarget: string | undefined;
}

/** Preview-project host only — never Production or other remote projects. */
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

function readDefaultInput(): DevMfaBypassInput {
	return {
		devMfaBypass: getEnv('DEV_MFA_BYPASS'),
		isDevServer: isDevEnvironment(),
		supabaseUrl: getEnv('SUPABASE_URL'),
		celebraRuntimeTarget: getEnv('CELEBRA_RUNTIME_TARGET'),
	};
}

export function isDevMfaBypassEnabled(input?: DevMfaBypassInput): boolean {
	const env = input ?? readDefaultInput();

	if (env.devMfaBypass !== 'true') return false;
	if (!env.isDevServer) return false;
	if (
		!isLocalProcess({
			supabaseUrl: env.supabaseUrl ?? '',
			isDevServer: env.isDevServer,
		})
	) {
		return false;
	}

	// Local Supabase (Integration and the Local-runtime lanes) or Preview project + target=preview
	if (isLocalSupabaseUrl(env.supabaseUrl)) return true;
	if (
		env.celebraRuntimeTarget?.trim().toLowerCase() === 'preview' &&
		isPreviewSupabaseUrl(env.supabaseUrl)
	) {
		return true;
	}

	return false;
}
