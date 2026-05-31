jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true),
	hashIp: jest.fn(() => 'hashed-ip'),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

describe('requireAdminRateLimit', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('uses a distinct entity bucket for each dashboard operation', async () => {
		const request = new Request('https://example.com/api/dashboard/intake/invitation', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminRateLimit(request, 'intake:regenerate');

		expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ entityId: 'intake:list:hashed-ip' }),
		);
		expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ entityId: 'intake:regenerate:hashed-ip' }),
		);
	});
});
