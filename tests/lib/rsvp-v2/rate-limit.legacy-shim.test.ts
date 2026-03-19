import { checkRateLimit as checkRateLimitProvider } from '@/lib/rsvp/security/rate-limit-provider';
import { checkRateLimit as checkLegacyRateLimit } from '@/lib/rsvp/security/rate-limit';

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

describe('legacy rateLimit shim', () => {
	it('delegates to rateLimitProvider with mapped shape', async () => {
		const providerMock = checkRateLimitProvider as jest.MockedFunction<
			typeof checkRateLimitProvider
		>;
		providerMock.mockResolvedValue(true);

		const allowed = await checkLegacyRateLimit('ctx:invite-1:127.0.0.1', 10, 60000);
		expect(allowed).toBe(true);
		expect(providerMock).toHaveBeenCalledWith(
			expect.objectContaining({
				namespace: 'ctx',
				entityId: 'invite-1',
				maxHits: 10,
			}),
		);
	});
});
