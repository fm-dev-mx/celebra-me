jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true),
	hashIp: jest.fn(() => 'hashed-ip'),
}));

import { checkRateLimit, hashIp } from '@/lib/rsvp/security/rate-limit-provider';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { CANONICAL_STATUS_RATE_LIMIT_OPERATION } from '@/pages/api/dashboard/estado/index';
import { ApiError } from '@/lib/rsvp/core/errors';

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockHashIp = hashIp as jest.MockedFunction<typeof hashIp>;

describe('requireAdminRateLimit', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('buckets by X-Forwarded-For outside Cloudflare Workers, even if CF-Connecting-IP is sent', async () => {
		const request = new Request('https://example.com/api/dashboard/intake/invitation', {
			headers: {
				'cf-connecting-ip': '203.0.113.9',
				'x-forwarded-for': '198.51.100.1, 10.0.0.2',
			},
		});

		await requireAdminRateLimit(request, 'intake:list');

		expect(mockHashIp).toHaveBeenCalledWith('198.51.100.1');
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ ip: '198.51.100.1' }),
		);
	});

	it('buckets by CF-Connecting-IP when running on Cloudflare Workers', async () => {
		const userAgent = jest
			.spyOn(globalThis.navigator, 'userAgent', 'get')
			.mockReturnValue('Cloudflare-Workers');
		const request = new Request('https://example.com/api/dashboard/intake/invitation', {
			headers: {
				'cf-connecting-ip': '203.0.113.9',
				'x-forwarded-for': '198.51.100.1, 10.0.0.2',
			},
		});

		try {
			await requireAdminRateLimit(request, 'intake:list');
		} finally {
			userAgent.mockRestore();
		}

		expect(mockHashIp).toHaveBeenCalledWith('203.0.113.9');
	});

	it('falls back to the unknown bucket when no proxy header is present', async () => {
		const request = new Request('https://example.com/api/dashboard/intake/invitation');

		await requireAdminRateLimit(request, 'intake:list');

		expect(mockHashIp).toHaveBeenCalledWith('unknown');
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

	it('registers all commercial Sales Workspace operation keys and allows them', async () => {
		const request = new Request('https://example.com/api/dashboard/commercial', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		await expect(
			requireAdminRateLimit(request, 'commercial:customers:create'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:customers:search'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:reconciliation:search'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:orders:create'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:orders:deposit-paid'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:meta-conversions:process'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'commercial:meta-conversions:requeue'),
		).resolves.not.toThrow();
	});

	it('registers password-reset admin operation and allows it', async () => {
		const request = new Request(
			'https://example.com/api/dashboard/admin/users/reset-password',
			{ headers: { 'x-forwarded-for': '10.0.0.1' } },
		);

		await expect(
			requireAdminRateLimit(request, 'admin:users:reset_password'),
		).resolves.not.toThrow();
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({
				entityId: 'admin:users:reset_password:hashed-ip',
				maxHits: 5,
				windowSec: 60,
			}),
		);
	});

	it('registers canonical status dashboard operation and allows it', async () => {
		const request = new Request('https://example.com/api/dashboard/estado', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		await expect(
			requireAdminRateLimit(request, CANONICAL_STATUS_RATE_LIMIT_OPERATION, 'user-1'),
		).resolves.not.toThrow();
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({
				entityId: 'admin:estado:user-1',
				maxHits: 6,
				windowSec: 60,
			}),
		);
	});

	it('throws a controlled ApiError for unregistered operation keys', async () => {
		const request = new Request('https://example.com/api/dashboard', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		await expect(
			requireAdminRateLimit(request, 'commercial:unknown' as never),
		).rejects.toBeInstanceOf(ApiError);
		await expect(
			requireAdminRateLimit(request, 'commercial:unknown' as never),
		).rejects.toMatchObject({
			status: 500,
			code: 'internal_error',
			message: 'Missing rate-limit configuration for operation: commercial:unknown',
		});
	});
});
