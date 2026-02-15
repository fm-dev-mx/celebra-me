import { defineMiddleware } from 'astro:middleware';

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
		// Get user info and app_metadata from Supabase Auth
		// We use the access token to get the user profile
		const userResponse = await fetch(`${import.meta.env.SUPABASE_URL}/auth/v1/user`, {
			headers: {
				apikey: import.meta.env.SUPABASE_ANON_KEY,
				Authorization: `Bearer ${sessionCookie.value}`,
			},
		});

		if (!userResponse.ok) {
			return redirect('/login');
		}

		const user = await userResponse.json();
		const role = user.app_metadata?.role;
		const aal = user.amr?.[0]?.method === 'mfa' ? 'aal2' : 'aal1';

		// If superadmin, enforce MFA (aal2)
		if (role === 'super_admin' && aal !== 'aal2') {
			if (url.pathname !== '/dashboard/mfa-setup') {
				return redirect('/dashboard/mfa-setup');
			}

			// For MFA setup page, we EXPOSE the token to JS so it can talk to Supabase
			// This is temporary until AAL2 is achieved
			cookies.set('sb-mfa-session', sessionCookie.value, {
				path: '/',
				httpOnly: false,
				sameSite: 'lax',
				maxAge: 300,
			});
		}

		return next();
	} catch (error) {
		console.error('[Middleware] Auth error:', error);
		return redirect('/login');
	}
});
