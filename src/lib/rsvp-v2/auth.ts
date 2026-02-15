import { getEnv } from '@/utils/env';

export interface HostSession {
	userId: string;
	email: string;
	accessToken: string;
}

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getTokenFromAuthorizationHeader(authorizationHeader: string | null): string {
	if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return '';
	return sanitize(authorizationHeader.slice('Bearer '.length));
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	return cookieHeader
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.reduce(
			(acc, part) => {
				const separator = part.indexOf('=');
				if (separator <= 0) return acc;
				const key = decodeURIComponent(part.slice(0, separator).trim());
				const value = decodeURIComponent(part.slice(separator + 1).trim());
				acc[key] = value;
				return acc;
			},
			{} as Record<string, string>,
		);
}

function getTokenFromCookieMap(cookieMap: Record<string, string>): string {
	if (cookieMap['sb-access-token']) return sanitize(cookieMap['sb-access-token']);

	for (const [cookieKey, cookieValue] of Object.entries(cookieMap)) {
		// supabase-js stores auth data in sb-<project-ref>-auth-token cookie
		if (!cookieKey.startsWith('sb-') || !cookieKey.endsWith('-auth-token')) continue;
		try {
			const parsed = JSON.parse(cookieValue) as
				| { access_token?: string }
				| [string | null, string | null]
				| null;
			if (Array.isArray(parsed)) {
				const accessToken = sanitize(parsed[0]);
				if (accessToken) return accessToken;
			}
			if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
				const accessToken = sanitize(parsed.access_token);
				if (accessToken) return accessToken;
			}
		} catch {
			// ignore malformed auth cookie
		}
	}

	return '';
}

export function resolveAccessTokenFromRequest(request: Request): string {
	const fromAuthorization = getTokenFromAuthorizationHeader(request.headers.get('authorization'));
	if (fromAuthorization) return fromAuthorization;
	return getTokenFromCookieMap(parseCookieHeader(request.headers.get('cookie')));
}

export async function getHostSessionFromRequest(request: Request): Promise<HostSession | null> {
	const accessToken = resolveAccessTokenFromRequest(request);
	if (!accessToken) return null;

	const supabaseUrl = getEnv('SUPABASE_URL');
	const anonKey = getEnv('SUPABASE_ANON_KEY');
	if (!supabaseUrl || !anonKey) {
		throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY son obligatorias para dashboard auth.');
	}

	const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
		headers: {
			apikey: anonKey,
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) return null;

	const user = (await response.json()) as { id?: string; email?: string };
	if (!user.id) return null;

	return {
		userId: user.id,
		email: sanitize(user.email, 320),
		accessToken,
	};
}

export async function requireHostSession(request: Request): Promise<HostSession> {
	const session = await getHostSessionFromRequest(request);
	if (!session) {
		throw new Error('No autorizado.');
	}
	return session;
}
