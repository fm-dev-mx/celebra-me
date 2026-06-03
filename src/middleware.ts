import { defineMiddleware } from 'astro:middleware';
import { getSupabaseUserByAccessToken } from '@/lib/rsvp/auth/auth';
import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { hasMfaEvidence } from '@/lib/rsvp/auth/auth-mfa-evidence';
import { refreshAccessToken } from '@/lib/rsvp/auth/auth-api';
import { normalizeAppRole } from '@/lib/rsvp/auth/roles';
import type { AppUserRole } from '@/interfaces/auth/session.interface';
import { verifyTrustedDeviceToken } from '@/lib/rsvp/security/trusted-device';
import { setCsrfToken } from '@/lib/rsvp/security/csrf';
import { isDevMfaBypassEnabled } from '@/lib/server/dev-mfa-bypass';

interface CookieStore {
	get(name: string): { value: string } | undefined;
	set(name: string, value: string, options: Record<string, unknown>): void;
	delete(name: string, options: Record<string, unknown>): void;
}

interface AuthContext {
	role: AppUserRole | null;
	hasMfa: boolean;
	trustedDevice: boolean;
	hasAdminStrongAuth: boolean;
}

const IDLE_TIMEOUT_SECONDS = 60 * 30;
const MFA_TEMP_MAX_AGE_SECONDS = 60 * 5;
const TRUST_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ADMIN_ONLY_PATHS = [
	'/dashboard/admin',
	'/dashboard/usuarios',
	'/dashboard/claimcodes',
	'/dashboard/invitaciones',
];

function isAdminOnlyPath(pathname: string): boolean {
	return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function shouldHandleAuth(pathname: string): boolean {
	return (
		pathname === '/login' ||
		pathname.startsWith('/dashboard') ||
		pathname.startsWith('/api/dashboard')
	);
}

function isPreviewRoute(pathname: string): boolean {
	return pathname.startsWith('/dashboard/invitaciones/') && pathname.endsWith('/preview');
}

function buildCookieOptions(maxAge: number) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		maxAge,
		secure: process.env.NODE_ENV === 'production',
	};
}

function clearPrimaryAuthCookies(cookies: CookieStore) {
	cookies.delete('sb-access-token', { path: '/' });
	cookies.delete('sb-refresh-token', { path: '/' });
	cookies.delete('sb-trust-device', { path: '/' });
}

function clearIdleSessionCookies(cookies: CookieStore) {
	clearPrimaryAuthCookies(cookies);
	cookies.delete('sb-mfa-session', { path: '/dashboard/mfa-setup' });
	cookies.delete('sb-idle-seen', { path: '/' });
}

function isIdleSessionExpired(cookies: CookieStore, now: number) {
	const idleSeenRaw = cookies.get('sb-idle-seen')?.value || '';
	const idleSeenAt = Number.parseInt(idleSeenRaw, 10);
	return Number.isFinite(idleSeenAt) && idleSeenAt > 0 && now - idleSeenAt > IDLE_TIMEOUT_SECONDS;
}

async function refreshUserSession(cookies: CookieStore, refreshToken: string) {
	try {
		const refreshed = await refreshAccessToken({ refreshToken });
		const accessToken = refreshed.access_token;
		const nextRefreshToken = refreshed.refresh_token || refreshToken;
		const user = await getSupabaseUserByAccessToken(accessToken);

		if (user) {
			cookies.set('sb-access-token', accessToken, buildCookieOptions(60 * 60));
			cookies.set(
				'sb-refresh-token',
				nextRefreshToken,
				buildCookieOptions(60 * 60 * 24 * 30),
			);
		}

		return {
			accessToken,
			refreshToken: nextRefreshToken,
			user,
		};
	} catch {
		clearPrimaryAuthCookies(cookies);
		return {
			accessToken: '',
			refreshToken: '',
			user: null,
		};
	}
}

function applyMfaSetupCookies(cookies: CookieStore, accessToken: string, refreshToken: string) {
	cookies.set('sb-mfa-session', accessToken, {
		path: '/dashboard/mfa-setup',
		httpOnly: false,
		sameSite: 'strict',
		maxAge: MFA_TEMP_MAX_AGE_SECONDS,
		secure: process.env.NODE_ENV === 'production',
	});

	if (refreshToken) {
		cookies.set('sb-mfa-refresh', refreshToken, {
			path: '/dashboard/mfa-setup',
			httpOnly: false,
			sameSite: 'strict',
			maxAge: MFA_TEMP_MAX_AGE_SECONDS,
			secure: process.env.NODE_ENV === 'production',
		});
	}
}

function clearMfaSetupCookies(cookies: CookieStore) {
	cookies.delete('sb-mfa-session', { path: '/dashboard/mfa-setup' });
	cookies.delete('sb-mfa-refresh', { path: '/dashboard/mfa-setup' });
}

function resolveAuthenticatedRedirect(
	pathname: string,
	role: string | null,
	hasAdminStrongAuth: boolean,
) {
	if (pathname === '/login') {
		if (role === 'super_admin') {
			return hasAdminStrongAuth ? '/dashboard/admin' : '/dashboard/mfa-setup';
		}

		return '/dashboard/invitados';
	}

	if (role === 'super_admin' && !hasAdminStrongAuth && pathname !== '/dashboard/mfa-setup') {
		return '/dashboard/mfa-setup';
	}

	if (role !== 'super_admin' && isAdminOnlyPath(pathname)) {
		return '/dashboard/invitados';
	}

	if (role !== 'super_admin' && pathname === '/dashboard/mfa-setup') {
		return '/dashboard/invitados';
	}

	if (role === 'super_admin' && pathname === '/dashboard/mfa-setup' && hasAdminStrongAuth) {
		return '/dashboard/admin';
	}

	return null;
}

async function resolveAuthenticatedUser(cookies: CookieStore) {
	let accessToken = cookies.get('sb-access-token')?.value || '';
	let refreshToken = cookies.get('sb-refresh-token')?.value || '';
	let user = accessToken ? await getSupabaseUserByAccessToken(accessToken) : null;

	if (!user && refreshToken) {
		const refreshed = await refreshUserSession(cookies, refreshToken);
		accessToken = refreshed.accessToken;
		refreshToken = refreshed.refreshToken;
		user = refreshed.user;
	}

	return { accessToken, refreshToken, user };
}

function resolveAuthContext(
	cookies: CookieStore,
	request: Request,
	user: NonNullable<Awaited<ReturnType<typeof getSupabaseUserByAccessToken>>>,
	accessToken: string,
): AuthContext {
	const role = normalizeAppRole(user.app_metadata?.role);
	const hasMfa = hasMfaEvidence({ token: accessToken, amr: user.amr });
	const trustCookie = cookies.get('sb-trust-device')?.value || '';
	const trustedDevice =
		role === 'super_admin' && trustCookie
			? verifyTrustedDeviceToken({
					token: trustCookie,
					userId: user.id,
					userAgent: request.headers.get('user-agent') || '',
					role,
				})
			: false;

	if (role === 'super_admin' && trustCookie && !trustedDevice) {
		cookies.delete('sb-trust-device', { path: '/' });
	}

	return {
		role,
		hasMfa,
		trustedDevice,
		hasAdminStrongAuth: hasMfa || trustedDevice,
	};
}

function syncPostAuthCookies(
	cookies: CookieStore,
	authContext: AuthContext,
	trustCookie: string,
	now: number,
) {
	if (authContext.hasMfa && cookies.get('sb-mfa-session')) {
		clearMfaSetupCookies(cookies);
	}

	if (authContext.role === 'super_admin' && authContext.trustedDevice) {
		cookies.set(
			'sb-trust-device',
			trustCookie,
			buildCookieOptions(TRUST_DEVICE_MAX_AGE_SECONDS),
		);
	}

	cookies.set('sb-idle-seen', String(now), buildCookieOptions(IDLE_TIMEOUT_SECONDS));
}

function buildSessionFromUser(
	user: NonNullable<Awaited<ReturnType<typeof getSupabaseUserByAccessToken>>>,
	accessToken: string,
	role: ReturnType<typeof normalizeAppRole>,
): SessionContext {
	const resolvedEmail = typeof user.email === 'string' ? user.email.trim().slice(0, 320) : '';
	return {
		userId: user.id,
		email: resolvedEmail,
		accessToken,
		role,
		isSuperAdmin: role === 'super_admin',
		amr: user.amr,
	};
}

function computeMfaBypass(authContext: AuthContext): {
	hasDevMfaBypass: boolean;
	effectiveAdminStrongAuth: boolean;
} {
	const hasDevMfaBypass =
		!authContext.hasAdminStrongAuth &&
		authContext.role === 'super_admin' &&
		isDevMfaBypassEnabled();
	return {
		hasDevMfaBypass,
		effectiveAdminStrongAuth: authContext.hasAdminStrongAuth || hasDevMfaBypass,
	};
}

async function handleProtectedAuthRequest(
	url: URL,
	cookies: CookieStore,
	redirect: (path: string) => Response,
	request: Request,
	next: () => Promise<Response>,
	locals: { session?: SessionContext; hasAdminStrongAuth?: boolean },
) {
	const now = Math.floor(Date.now() / 1000);
	const isApiRoute = url.pathname.startsWith('/api/dashboard');

	if (
		url.pathname === '/login' &&
		!cookies.get('sb-access-token') &&
		!cookies.get('sb-refresh-token')
	) {
		return next();
	}

	if (!isApiRoute && isIdleSessionExpired(cookies, now)) {
		clearIdleSessionCookies(cookies);
		return redirect('/login');
	}

	const { accessToken, refreshToken, user } = await resolveAuthenticatedUser(cookies);
	if (!user) {
		if (isApiRoute) return next();
		return url.pathname === '/login' ? next() : redirect('/login');
	}

	const authContext = resolveAuthContext(cookies, request, user, accessToken);
	if (!authContext.role) {
		clearPrimaryAuthCookies(cookies);
		if (isApiRoute) return next();
		return redirect('/login');
	}

	const trustCookie = cookies.get('sb-trust-device')?.value || '';
	const { effectiveAdminStrongAuth } = computeMfaBypass(authContext);

	if (authContext.role === 'super_admin' && !effectiveAdminStrongAuth) {
		applyMfaSetupCookies(cookies, accessToken, refreshToken);
	}

	if (!isApiRoute) {
		const redirectTarget = resolveAuthenticatedRedirect(
			url.pathname,
			authContext.role,
			effectiveAdminStrongAuth,
		);
		if (redirectTarget) return redirect(redirectTarget);
	}

	syncPostAuthCookies(cookies, authContext, trustCookie, now);

	locals.session = buildSessionFromUser(user, accessToken, authContext.role);
	locals.hasAdminStrongAuth = effectiveAdminStrongAuth;

	return next();
}

export const onRequest = defineMiddleware(
	async ({ url, cookies, redirect, request, locals }, next) => {
		if (!shouldHandleAuth(url.pathname)) {
			return next();
		}

		if (!url.pathname.startsWith('/api/') && !isPreviewRoute(url.pathname)) {
			locals.csrfToken = setCsrfToken(cookies);
		}

		try {
			return await handleProtectedAuthRequest(
				url,
				cookies,
				redirect,
				request,
				next as () => Promise<Response>,
				locals,
			);
		} catch (error) {
			console.error('[Middleware] Auth error:', error);
			return redirect('/login');
		}
	},
);
