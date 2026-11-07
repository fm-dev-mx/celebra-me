import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';

export const authLogoutHelper = {
	redirect: (url: string) => window.location.assign(url),
};

export async function logoutAndRedirect(
	target = '/login',
	options: { allDevices?: boolean } = {},
): Promise<void> {
	if (options.allDevices) {
		await authBridgeApi.logoutAllDevices();
	} else {
		await authBridgeApi.logout();
	}

	try {
		window.localStorage.removeItem('rsvp-dashboard-event-id');
	} catch {
		// ignore
	}

	authLogoutHelper.redirect(target);
}
