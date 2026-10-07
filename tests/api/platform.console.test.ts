jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/platform/server/platform-usage.service', () => ({
	getPlatformUsageReport: jest.fn(),
}));

import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { getPlatformUsageReport } from '@/lib/platform/server/platform-usage.service';
import type { PlatformUsageReport } from '@/lib/platform/contract/types';
import { GET as getPlatformUsage } from '@/pages/api/dashboard/admin/platform/usage';
import { createMockRequest } from '../helpers/api-mocks';

const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockReport = getPlatformUsageReport as jest.MockedFunction<typeof getPlatformUsageReport>;

type RouteContext = Parameters<typeof getPlatformUsage>[0];

const adminSession: SessionContext = {
	userId: 'admin-1',
	email: 'admin@example.com',
	accessToken: 'admin-access-token',
	role: 'super_admin',
	isSuperAdmin: true,
};

const REPORT: PlatformUsageReport = [
	{
		id: 'production',
		cards: [
			{ provider: 'cloudflare', usage: { kind: 'unconfigured', missing: [] } },
			{ provider: 'supabase', usage: { kind: 'unconfigured', missing: [] } },
		],
	},
	{
		id: 'shared',
		cards: [
			{ provider: 'cloudflare', usage: { kind: 'unconfigured', missing: [] } },
			{ provider: 'vercel', usage: { kind: 'unconfigured', missing: [] } },
			{ provider: 'cloudinary', usage: { kind: 'unconfigured', missing: [] } },
		],
	},
];

function context(url: string): RouteContext {
	const request = createMockRequest(undefined, undefined, url);
	return {
		request,
		params: {},
		cookies: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), has: jest.fn() },
		locals: { session: adminSession },
		url: new URL(request.url),
	} as unknown as RouteContext;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockAdminRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue(adminSession);
	mockReport.mockResolvedValue(REPORT);
});

describe('GET /api/dashboard/admin/platform/usage', () => {
	it('throttles, requires a strong admin session and returns the aggregated report', async () => {
		const response = await getPlatformUsage(
			context('https://celebra-me.com/api/dashboard/admin/platform/usage'),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ usage: REPORT });
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockAdminRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(String) }),
			'platform:usage',
		);
		expect(mockStrongSession).toHaveBeenCalled();
	});

	it('answers a host or weak session with 403 without reaching any provider', async () => {
		mockStrongSession.mockRejectedValue(new ApiError(403, 'forbidden', 'Sin acceso.'));
		const response = await getPlatformUsage(
			context('https://celebra-me.com/api/dashboard/admin/platform/usage'),
		);

		expect(response.status).toBe(403);
		expect(mockReport).not.toHaveBeenCalled();
	});
});
