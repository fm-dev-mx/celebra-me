jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn().mockResolvedValue(true),
	hashIp: jest.fn(() => 'hashed-ip'),
}));

import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	ADMIN_RATE_LIMIT_OPERATIONS,
	requireAdminRateLimit,
} from '@/lib/rsvp/security/admin-rate-limit';
import { OBSERVABILITY_RATE_LIMIT_OPERATION } from '@/pages/api/dashboard/observabilidad/index';
import { ApiError } from '@/lib/rsvp/core/errors';

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

	it('registers all Content Sync operation names and allows them', async () => {
		const request = new Request('https://example.com/api/dashboard/admin/content-drift', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		await expect(requireAdminRateLimit(request, 'admin:content-drift')).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'admin:content-drift-demo'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'admin:demo-publish-dry-run'),
		).resolves.not.toThrow();
		await expect(
			requireAdminRateLimit(request, 'admin:demo-publish-confirm'),
		).resolves.not.toThrow();
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

	it('registers observability dashboard operation and allows it', async () => {
		const request = new Request('https://example.com/api/dashboard/observabilidad', {
			headers: { 'x-forwarded-for': '10.0.0.1' },
		});

		expect(ADMIN_RATE_LIMIT_OPERATIONS).toContain(OBSERVABILITY_RATE_LIMIT_OPERATION);
		await expect(
			requireAdminRateLimit(request, OBSERVABILITY_RATE_LIMIT_OPERATION, 'user-1'),
		).resolves.not.toThrow();
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({
				entityId: 'admin:observabilidad:user-1',
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
