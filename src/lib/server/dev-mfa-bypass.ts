import { isDevEnvironment } from '@/lib/environment';
import { isLocalProcess, isLocalSupabaseUrl } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';
import { isPreviewSupabaseUrl } from '@/lib/server/preview-supabase-url';

export interface DevMfaBypassInput {
	devMfaBypass: string | undefined;
	/** Build-time `import.meta.env.DEV`: only the Astro dev server qualifies. */
	isDevServer: boolean;
	supabaseUrl: string | undefined;
	celebraRuntimeTarget: string | undefined;
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
