import { getEnv } from '@/lib/server/env';
import { ApiError } from '@/lib/rsvp/core/errors';
import { normalizeAppRole, isSuperAdminRole } from '@/lib/rsvp/auth/roles';
import type { AppUserRole } from '@/interfaces/auth/session.interface';

export interface HostSession {
	userId: string;
	email: string;
	accessToken: string;
}

export interface SessionContext extends HostSession {
	role: AppUserRole | null;
	isSuperAdmin: boolean;
	amr?: Array<{ method?: string }>;
}

export interface SupabaseAuthUser {
	id: string;
	email?: string;
	app_metadata?: { role?: string };
	amr?: Array<{ method?: string }>;
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

export async function getSupabaseUserByAccessToken(
	accessToken: string,
): Promise<SupabaseAuthUser | null> {
	const normalizedToken = sanitize(accessToken);
	if (!normalizedToken) return null;

	const supabaseUrl = getEnv('SUPABASE_URL');
	const anonKey = getEnv('SUPABASE_ANON_KEY');
	if (!supabaseUrl || !anonKey) {
		throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for dashboard auth.');
	}

	const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
		headers: {
			apikey: anonKey,
			Authorization: `Bearer ${normalizedToken}`,
		},
	});

	if (!response.ok) return null;

	const user = (await response.json()) as SupabaseAuthUser;
	if (!user.id) return null;

	return user;
}

export async function getHostSessionFromRequest(request: Request): Promise<HostSession | null> {
	const context = await getSessionContextFromRequest(request);
	if (!context) return null;
	return {
		userId: context.userId,
		email: context.email,
		accessToken: context.accessToken,
	};
}

export async function getSessionContextFromRequest(
	request: Request,
): Promise<SessionContext | null> {
	const accessToken = resolveAccessTokenFromRequest(request);
	if (!accessToken) return null;
	const user = await getSupabaseUserByAccessToken(accessToken);
	if (!user) return null;
	const role = normalizeAppRole(user.app_metadata?.role);

	return {
		userId: user.id,
		email: sanitize(user.email, 320),
		accessToken,
		role,
		isSuperAdmin: isSuperAdminRole(role),
		amr: user.amr,
	};
}

export async function requireHostSession(request: Request): Promise<HostSession> {
	const session = await getHostSessionFromRequest(request);
	if (!session) {
		throw new ApiError(401, 'unauthorized', 'Unauthorized.');
	}
	return session;
}

export async function requireSessionContext(request: Request): Promise<SessionContext> {
	const context = await getSessionContextFromRequest(request);
	if (!context) {
		throw new ApiError(401, 'unauthorized', 'Unauthorized.');
	}
	return context;
}
