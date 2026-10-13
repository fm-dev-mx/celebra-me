import { isDevEnvironment } from '@/lib/environment';
import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import { isLocalProcess } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';

export interface DevMfaBypassInput {
	devMfaBypass: string | undefined;
	/** Declared hosted identity (tests only); any value disables the bypass. */
	deployEnv?: string;
	/** Build-time `import.meta.env.DEV`: only the Astro dev server qualifies. */
	isDevServer: boolean;
	supabaseUrl: string | undefined;
	celebraRuntimeTarget: string | undefined;
}

const LOCAL_SUPABASE_HOSTNAMES = ['127.0.0.1', 'localhost'];

function isLocalSupabaseUrl(urlString: string | undefined): boolean {
	if (!urlString) return false;
	try {
		const url = new URL(urlString);
		return (
			url.protocol === 'http:' &&
			LOCAL_SUPABASE_HOSTNAMES.includes(url.hostname) &&
			url.port === '54321' &&
			!url.username &&
			!url.password
		);
	} catch {
		return false;
	}
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
			deployEnv: env.deployEnv,
			supabaseUrl: env.supabaseUrl ?? '',
			isDevServer: env.isDevServer,
		})
	) {
		return false;
	}

	// Local Supabase (integration / dev-local) or Preview project + target=preview
	if (isLocalSupabaseUrl(env.supabaseUrl)) return true;
	if (
		env.celebraRuntimeTarget?.trim().toLowerCase() === 'preview' &&
		isPreviewSupabaseUrl(env.supabaseUrl)
	) {
		return true;
	}

	return false;
}
