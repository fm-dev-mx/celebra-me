import { authBridgeApi } from '@/lib/client/auth/auth-bridge-api';

export async function logoutAndRedirect(target = '/login'): Promise<void> {
	await authBridgeApi.logout();

	try {
		window.localStorage.removeItem('rsvp-dashboard-event-id');
	} catch {
		// ignore
	}

	window.location.assign(target);
}
