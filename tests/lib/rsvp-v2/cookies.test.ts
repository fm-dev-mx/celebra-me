import {
	buildIdleActivityCookie,
	buildMfaRefreshCookie,
	buildMfaSessionCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	clearIdleActivityCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
} from '@/lib/rsvp/cookies';

describe('rsvp cookies', () => {
	it('builds hardened access token cookie with ttl', () => {
		const cookie = buildSessionCookie('token-123');
		expect(cookie).toContain('sb-access-token=token-123');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).toContain('Max-Age=3600');
	});

	it('builds refresh token cookie with long ttl', () => {
		const cookie = buildRefreshTokenCookie('refresh-123');
		expect(cookie).toContain('sb-refresh-token=refresh-123');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Max-Age=2592000');
	});

	it('builds idle activity cookie and supports cleanup helpers', () => {
		const activeCookie = buildIdleActivityCookie(12345);
		expect(activeCookie).toContain('sb-idle-seen=12345');
		expect(activeCookie).toContain('HttpOnly');
		expect(activeCookie).toContain('Max-Age=1800');

		expect(clearSessionCookie()).toContain('Max-Age=0');
		expect(clearRefreshTokenCookie()).toContain('Max-Age=0');
		expect(clearMfaSessionCookie()).toContain('Max-Age=0');
		expect(clearMfaRefreshCookie()).toContain('Max-Age=0');
		expect(clearIdleActivityCookie()).toContain('Max-Age=0');
	});

	it('builds temporary MFA cookies with 5-minute ttl', () => {
		const sessionCookie = buildMfaSessionCookie('mfa-token');
		const refreshCookie = buildMfaRefreshCookie('mfa-refresh');

		expect(sessionCookie).toContain('sb-mfa-session=mfa-token');
		expect(sessionCookie).toContain('Path=/dashboard/mfa-setup');
		expect(sessionCookie).toContain('Max-Age=300');

		expect(refreshCookie).toContain('sb-mfa-refresh=mfa-refresh');
		expect(refreshCookie).toContain('Path=/dashboard/mfa-setup');
		expect(refreshCookie).toContain('Max-Age=300');
	});
});
