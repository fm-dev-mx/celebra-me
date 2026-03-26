import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';

export async function logoutAndRedirect(target = '/'): Promise<void> {
	try {
		await authBridgeApi.logout();
	} catch {
		// Ignore transport errors; local cleanup + redirect still apply.
	}

	try {
		window.localStorage.removeItem('rsvp-dashboard-event-id');
	} catch {
		// ignore
	}

	window.location.assign(target);
}
