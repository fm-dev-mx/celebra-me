import {
	buildIdleActivityCookie,
	buildMfaRefreshCookie,
	buildMfaSessionCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
	buildTrustedDeviceCookie,
	clearIdleActivityCookie,
	clearMfaRefreshCookie,
	clearMfaSessionCookie,
	clearRefreshTokenCookie,
	clearSessionCookie,
	clearTrustedDeviceCookie,
} from '@/lib/rsvp/auth/cookies';

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

describe('cookie transport security', () => {
	const originalDeployEnv = process.env.CELEBRA_DEPLOY_ENV;
	const originalSupabaseUrl = process.env.SUPABASE_URL;
	const cookies = (): string[] => [
		buildSessionCookie('t'),
		buildRefreshTokenCookie('t'),
		buildMfaSessionCookie('t'),
		buildMfaRefreshCookie('t'),
		buildIdleActivityCookie(1),
		buildTrustedDeviceCookie('t'),
		clearSessionCookie(),
		clearRefreshTokenCookie(),
		clearMfaSessionCookie(),
		clearMfaRefreshCookie(),
		clearIdleActivityCookie(),
		clearTrustedDeviceCookie(),
	];

	afterEach(() => {
		if (originalDeployEnv === undefined) delete process.env.CELEBRA_DEPLOY_ENV;
		else process.env.CELEBRA_DEPLOY_ENV = originalDeployEnv;
		if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
		else process.env.SUPABASE_URL = originalSupabaseUrl;
	});

	it('marks every cookie Secure on a hosted deployment', () => {
		process.env.CELEBRA_DEPLOY_ENV = 'preview';
		for (const cookie of cookies()) expect(cookie).toContain('; Secure');
	});

	it('marks every cookie Secure when the deploy identity is ambiguous', () => {
		delete process.env.CELEBRA_DEPLOY_ENV;
		delete process.env.SUPABASE_URL;
		for (const cookie of cookies()) expect(cookie).toContain('; Secure');
	});

	it('omits Secure only for a positively local process', () => {
		delete process.env.CELEBRA_DEPLOY_ENV;
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
		for (const cookie of cookies()) expect(cookie).not.toContain('Secure');
	});
});
