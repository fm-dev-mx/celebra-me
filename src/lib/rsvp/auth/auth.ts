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

export interface SessionDebugSnapshot {
	hasAccessToken: boolean;
	tokenSource: 'authorization' | 'cookie' | 'none';
	reason: 'missing_access_token' | 'invalid_supabase_user' | 'session_role_resolved';
	context: SessionContext | null;
}

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function getTokenFromAuthorizationHeader(authorizationHeader: string | null): string {
	if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return '';
	return sanitize(authorizationHeader.slice('Bearer '.length));
}

function hasBearerAuthorizationHeader(authorizationHeader: string | null): boolean {
	return Boolean(authorizationHeader && authorizationHeader.startsWith('Bearer '));
}

function shouldLogSessionDebug(request: Request): boolean {
	if (process.env.NODE_ENV === 'production') return false;
	try {
		return new URL(request.url).searchParams.get('debug') === '1';
	} catch {
		return false;
	}
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

export function resolveAccessTokenSourceFromRequest(
	request: Request,
): 'authorization' | 'cookie' | 'none' {
	if (hasBearerAuthorizationHeader(request.headers.get('authorization'))) {
		return 'authorization';
	}
	const cookieToken = getTokenFromCookieMap(parseCookieHeader(request.headers.get('cookie')));
	return cookieToken ? 'cookie' : 'none';
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

export async function getSessionDebugSnapshotFromRequest(
	request: Request,
): Promise<SessionDebugSnapshot> {
	const debugEnabled = shouldLogSessionDebug(request);
	const tokenSource = resolveAccessTokenSourceFromRequest(request);
	const accessToken = resolveAccessTokenFromRequest(request);
	if (!accessToken) {
		if (debugEnabled) {
			console.info('[auth][session-debug]', {
				hasAccessToken: false,
				tokenSource,
				reason: 'missing_access_token',
			});
		}
		return {
			hasAccessToken: false,
			tokenSource,
			reason: 'missing_access_token',
			context: null,
		};
	}

	const user = await getSupabaseUserByAccessToken(accessToken);
	if (!user) {
		if (debugEnabled) {
			console.info('[auth][session-debug]', {
				hasAccessToken: true,
				tokenSource,
				reason: 'invalid_supabase_user',
			});
		}
		return {
			hasAccessToken: true,
			tokenSource,
			reason: 'invalid_supabase_user',
			context: null,
		};
	}

	const role = normalizeAppRole(user.app_metadata?.role);
	const snapshot: SessionDebugSnapshot = {
		hasAccessToken: true,
		tokenSource,
		reason: 'session_role_resolved',
		context: {
			userId: user.id,
			email: sanitize(user.email, 320),
			accessToken,
			role,
			isSuperAdmin: isSuperAdminRole(role),
			amr: user.amr,
		},
	};
	if (debugEnabled) {
		console.info('[auth][session-debug]', {
			hasAccessToken: true,
			tokenSource,
			reason: 'session_role_resolved',
			userId: snapshot.context?.userId,
			email: snapshot.context?.email,
			role: snapshot.context?.role,
		});
	}
	return snapshot;
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
	const snapshot = await getSessionDebugSnapshotFromRequest(request);
	return snapshot.context;
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
