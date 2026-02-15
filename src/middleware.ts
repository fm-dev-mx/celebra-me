import { defineMiddleware } from 'astro:middleware';
import { getSupabaseUserByAccessToken } from '@/lib/rsvp-v2/auth';
import { hasMfaEvidence } from '@/lib/rsvp-v2/authMfaEvidence';

const IDLE_TIMEOUT_SECONDS = 60 * 30;
const MFA_TEMP_MAX_AGE_SECONDS = 60 * 5;

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
	// Only protect /dashboard routes
	if (!url.pathname.startsWith('/dashboard')) {
		return next();
	}

	const sessionCookie = cookies.get('sb-access-token');
	if (!sessionCookie) {
		return redirect('/login');
	}

	try {
		const now = Math.floor(Date.now() / 1000);
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
			return redirect('/login');
		}

		const user = await getSupabaseUserByAccessToken(sessionCookie.value);
		if (!user) {
			return redirect('/login');
		}
		const role = user.app_metadata?.role;
		const hasMfa = hasMfaEvidence({
			token: sessionCookie.value,
			amr: user.amr,
		});
		const aal = hasMfa ? 'aal2' : 'aal1';

		// If superadmin, enforce MFA (aal2)
		if (role === 'super_admin' && aal !== 'aal2') {
			if (url.pathname !== '/dashboard/mfa-setup') {
				return redirect('/dashboard/mfa-setup');
			}

			const refreshCookie = cookies.get('sb-refresh-token');
			cookies.set('sb-mfa-session', sessionCookie.value, {
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
		if (aal === 'aal2' && cookies.get('sb-mfa-session')) {
			cookies.delete('sb-mfa-session', {
				path: '/dashboard/mfa-setup',
			});
			cookies.delete('sb-mfa-refresh', {
				path: '/dashboard/mfa-setup',
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
});
