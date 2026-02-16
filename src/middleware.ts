import { defineMiddleware } from 'astro:middleware';
import { getSupabaseUserByAccessToken } from '@/lib/rsvp-v2/auth';
import { hasMfaEvidence } from '@/lib/rsvp-v2/authMfaEvidence';
import { refreshAccessToken } from '@/lib/rsvp-v2/authApi';
import { normalizeAppRole } from '@/lib/rsvp-v2/roles';
import { verifyTrustedDeviceToken } from '@/lib/rsvp-v2/trustedDevice';
import { setCsrfToken } from '@/lib/rsvp-v2/csrf';

const IDLE_TIMEOUT_SECONDS = 60 * 30;
const MFA_TEMP_MAX_AGE_SECONDS = 60 * 5;
const TRUST_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ADMIN_ONLY_PATHS = [
	'/dashboard/admin',
	'/dashboard/usuarios',
	'/dashboard/claimcodes',
	'/dashboard/eventos',
];

function isAdminOnlyPath(pathname: string): boolean {
	return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function shouldInspectAuthPath(pathname: string): boolean {
	return pathname === '/login' || pathname.startsWith('/dashboard');
}

export const onRequest = defineMiddleware(
	async ({ url, cookies, redirect, request, locals }, next) => {
		if (!shouldInspectAuthPath(url.pathname)) {
			return next();
		}

		// Always generate CSRF token for dashboard and login paths to ensure it's available in layouts
		locals.csrfToken = setCsrfToken(cookies);

		try {
			let accessToken = cookies.get('sb-access-token')?.value || '';
			let refreshToken = cookies.get('sb-refresh-token')?.value || '';
			const now = Math.floor(Date.now() / 1000);

			// If login route and no auth at all, continue.
			if (url.pathname === '/login' && !accessToken && !refreshToken) {
				return next();
			}

			const idleSeenRaw = cookies.get('sb-idle-seen')?.value || '';
			const idleSeenAt = Number.parseInt(idleSeenRaw, 10);
			if (
				Number.isFinite(idleSeenAt) &&
				idleSeenAt > 0 &&
				now - idleSeenAt > IDLE_TIMEOUT_SECONDS
			) {
				cookies.delete('sb-access-token', { path: '/' });
				cookies.delete('sb-refresh-token', { path: '/' });
				cookies.delete('sb-mfa-session', { path: '/dashboard/mfa-setup' });
				cookies.delete('sb-idle-seen', { path: '/' });
				cookies.delete('sb-trust-device', { path: '/' });
				return redirect('/login');
			}

			let user = accessToken ? await getSupabaseUserByAccessToken(accessToken) : null;
			if (!user && refreshToken) {
				try {
					const refreshed = await refreshAccessToken({ refreshToken });
					accessToken = refreshed.access_token;
					refreshToken = refreshed.refresh_token || refreshToken;
					user = await getSupabaseUserByAccessToken(accessToken);
					if (user) {
						cookies.set('sb-access-token', accessToken, {
							path: '/',
							httpOnly: true,
							sameSite: 'lax',
							maxAge: 60 * 60,
							secure: process.env.NODE_ENV === 'production',
						});
						cookies.set('sb-refresh-token', refreshToken, {
							path: '/',
							httpOnly: true,
							sameSite: 'lax',
							maxAge: 60 * 60 * 24 * 30,
							secure: process.env.NODE_ENV === 'production',
						});
					}
				} catch {
					cookies.delete('sb-access-token', { path: '/' });
					cookies.delete('sb-refresh-token', { path: '/' });
					cookies.delete('sb-trust-device', { path: '/' });
				}
			}

			if (!user) {
				if (url.pathname === '/login') return next();
				return redirect('/login');
			}

			const role = normalizeAppRole(user.app_metadata?.role);
			const hasMfa = hasMfaEvidence({
				token: accessToken,
				amr: user.amr,
			});
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
			const hasAdminStrongAuth = hasMfa || trustedDevice;

			if (url.pathname === '/login') {
				if (role === 'super_admin') {
					return redirect(
						hasAdminStrongAuth ? '/dashboard/admin' : '/dashboard/mfa-setup',
					);
				}
				return redirect('/dashboard/invitados');
			}

			if (role === 'super_admin' && !hasAdminStrongAuth) {
				if (url.pathname !== '/dashboard/mfa-setup') {
					return redirect('/dashboard/mfa-setup');
				}

				const refreshCookie = cookies.get('sb-refresh-token');
				cookies.set('sb-mfa-session', accessToken, {
					path: '/dashboard/mfa-setup',
					httpOnly: false,
					sameSite: 'strict',
					maxAge: MFA_TEMP_MAX_AGE_SECONDS,
					secure: process.env.NODE_ENV === 'production',
				});
				if (refreshCookie?.value) {
					cookies.set('sb-mfa-refresh', refreshCookie.value, {
						path: '/dashboard/mfa-setup',
						httpOnly: false,
						sameSite: 'strict',
						maxAge: MFA_TEMP_MAX_AGE_SECONDS,
						secure: process.env.NODE_ENV === 'production',
					});
				}
			}

			if (role !== 'super_admin' && isAdminOnlyPath(url.pathname)) {
				return redirect('/dashboard/invitados');
			}
			if (role !== 'super_admin' && url.pathname === '/dashboard/mfa-setup') {
				return redirect('/dashboard/invitados');
			}
			if (
				role === 'super_admin' &&
				url.pathname === '/dashboard/mfa-setup' &&
				hasAdminStrongAuth
			) {
				return redirect('/dashboard/admin');
			}

			if (hasMfa && cookies.get('sb-mfa-session')) {
				cookies.delete('sb-mfa-session', {
					path: '/dashboard/mfa-setup',
				});
				cookies.delete('sb-mfa-refresh', {
					path: '/dashboard/mfa-setup',
				});
			}
			if (role === 'super_admin' && trustedDevice) {
				cookies.set('sb-trust-device', trustCookie, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					maxAge: TRUST_DEVICE_MAX_AGE_SECONDS,
					secure: process.env.NODE_ENV === 'production',
				});
			}

			cookies.set('sb-idle-seen', String(now), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: IDLE_TIMEOUT_SECONDS,
				secure: process.env.NODE_ENV === 'production',
			});

			return next();
		} catch (error) {
			console.error('[Middleware] Auth error:', error);
			return redirect('/login');
		}
	},
);
