import { sanitize, parseCookieHeader } from '@/lib/rsvp/core/utils';
import { ApiError, isRejectedAuthCredential } from '@/lib/rsvp/core/errors';
import { getAuthUserByAccessToken, type SupabaseAuthUser } from '@/lib/rsvp/auth/auth-api';
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
	mustChangePassword?: boolean;
	amr?: Array<{ method?: string }>;
}

export type { SupabaseAuthUser } from '@/lib/rsvp/auth/auth-api';

export interface SessionDebugSnapshot {
	hasAccessToken: boolean;
	tokenSource: 'authorization' | 'cookie' | 'none';
	reason: 'missing_access_token' | 'invalid_supabase_user' | 'session_role_resolved';
	context: SessionContext | null;
}

function getTokenFromAuthorizationHeader(authorizationHeader: string | null): string {
	if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return '';
	return sanitize(authorizationHeader.slice('Bearer '.length), 4096);
}

function hasBearerAuthorizationHeader(authorizationHeader: string | null): boolean {
	return Boolean(authorizationHeader && authorizationHeader.startsWith('Bearer '));
}

function getTokenFromCookieMap(cookieMap: Record<string, string>): string {
	if (cookieMap['sb-access-token']) return sanitize(cookieMap['sb-access-token'], 4096);

	for (const [cookieKey, cookieValue] of Object.entries(cookieMap)) {
		// supabase-js stores auth data in sb-<project-ref>-auth-token cookie
		if (!cookieKey.startsWith('sb-') || !cookieKey.endsWith('-auth-token')) continue;
		try {
			const parsed = JSON.parse(cookieValue) as
				{ access_token?: string } | [string | null, string | null] | null;
			if (Array.isArray(parsed)) {
				const accessToken = sanitize(parsed[0], 4096);
				if (accessToken) return accessToken;
			}
			if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
				const accessToken = sanitize(parsed.access_token, 4096);
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
	const normalizedToken = sanitize(accessToken, 4096);
	if (!normalizedToken) return null;

	try {
		return await getAuthUserByAccessToken(normalizedToken);
	} catch (error) {
		if (isRejectedAuthCredential(error)) return null;
		throw error;
	}
}

export async function getSessionDebugSnapshotFromRequest(
	request: Request,
): Promise<SessionDebugSnapshot> {
	const tokenSource = resolveAccessTokenSourceFromRequest(request);
	const accessToken = resolveAccessTokenFromRequest(request);
	if (!accessToken) {
		return {
			hasAccessToken: false,
			tokenSource,
			reason: 'missing_access_token',
			context: null,
		};
	}

	const user = await getSupabaseUserByAccessToken(accessToken);
	if (!user) {
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
			mustChangePassword: user.app_metadata?.must_change_password === true,
			amr: user.amr,
		},
	};
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
