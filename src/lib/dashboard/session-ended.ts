const SESSION_EXPIRED_LOGIN_URL = '/login?reason=session_expired';

/** Sends the person to the login page, which explains that the session ended. */
export function goToLoginAfterSessionEnded(): void {
	if (typeof window !== 'undefined') window.location.assign(SESSION_EXPIRED_LOGIN_URL);
}
