export async function logoutAndRedirect(target = '/'): Promise<void> {
	try {
		await fetch('/api/auth/logout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});
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
