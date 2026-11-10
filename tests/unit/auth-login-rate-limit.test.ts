import {
	enforceLoginRateLimit,
	enforceLoginAccountRateLimit,
} from '@/lib/rsvp/security/auth-security';
import { resetRateLimitProviderForTests } from '@/lib/rsvp/security/rate-limit-provider';

jest.mock('@/lib/server/platform-request', () => ({
	getClientIp: (request: Request) => request.headers.get('test-ip'),
}));

const attempt = (identifier: string, ip: string) =>
	enforceLoginRateLimit({
		identifier,
		request: new Request('https://example.test', { headers: { 'test-ip': ip } }),
	});

describe('login rate limits', () => {
	beforeEach(() => {
		resetRateLimitProviderForTests();
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.useRealTimers();
	});
	it('limits an IP across changing identifiers and resets after ten minutes', async () => {
		for (let i = 0; i < 30; i++) await attempt(`alias${i}`, 'ip1');
		await expect(attempt('another', 'ip1')).rejects.toMatchObject({ status: 429 });
		await expect(attempt('another', 'ip2')).resolves.toBeUndefined();
		jest.advanceTimersByTime(600_001);
		await expect(attempt('another', 'ip1')).resolves.toBeUndefined();
	});
	it('limits an identifier across changing IPs for fifteen minutes', async () => {
		for (let i = 0; i < 10; i++) await attempt('alice', `ip${i}`);
		await expect(attempt('alice', 'new-ip')).rejects.toMatchObject({ status: 429 });
		await expect(attempt('bob', 'new-ip')).resolves.toBeUndefined();
		jest.advanceTimersByTime(900_001);
		await expect(attempt('alice', 'new-ip')).resolves.toBeUndefined();
	});
	it('shares the resolved account budget between alias and email logins', async () => {
		for (let i = 0; i < 10; i++)
			await enforceLoginAccountRateLimit(i % 2 ? 'Alice@Example.Test' : 'alice@example.test');
		await expect(enforceLoginAccountRateLimit('alice@example.test')).rejects.toMatchObject({
			status: 429,
		});
	});
});
