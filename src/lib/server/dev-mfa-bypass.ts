import { getEnv } from '@/lib/server/env';

export interface DevMfaBypassInput {
	devMfaBypass: string | undefined;
	nodeEnv: string | undefined;
	vercel: string | undefined;
	vercelEnv: string | undefined;
	supabaseUrl: string | undefined;
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

function isVercel(vercel: string | undefined, vercelEnv: string | undefined): boolean {
	return vercel === '1' || vercelEnv === 'production' || vercelEnv === 'preview';
}

function readDefaultInput(): DevMfaBypassInput {
	return {
		devMfaBypass: getEnv('DEV_MFA_BYPASS'),
		nodeEnv: getEnv('NODE_ENV') || 'development',
		vercel: getEnv('VERCEL'),
		vercelEnv: getEnv('VERCEL_ENV'),
		supabaseUrl: getEnv('SUPABASE_URL'),
	};
}

export function isDevMfaBypassEnabled(input?: DevMfaBypassInput): boolean {
	const env = input ?? readDefaultInput();

	if (env.devMfaBypass !== 'true') return false;
	if (env.nodeEnv !== 'development') return false;
	if (isVercel(env.vercel, env.vercelEnv)) return false;
	if (!isLocalSupabaseUrl(env.supabaseUrl)) return false;

	return true;
}
