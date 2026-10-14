jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/engagement.repository', () => ({
	listInvitationEngagementRankingV2Rpc: jest.fn(),
}));

import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { listInvitationEngagementRankingV2Rpc } from '@/lib/rsvp/repositories/engagement.repository';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import { GET as getRanking } from '@/pages/api/dashboard/admin/engagement/ranking';
import { createMockRequest } from '../helpers/api-mocks';

const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockRpc = listInvitationEngagementRankingV2Rpc as jest.MockedFunction<
	typeof listInvitationEngagementRankingV2Rpc
>;

type RouteContext = Parameters<typeof getRanking>[0];

const adminSession: SessionContext = {
	userId: 'admin-1',
	email: 'admin@example.com',
	accessToken: 'admin-access-token',
	role: 'super_admin',
	isSuperAdmin: true,
};

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

const BASE = 'https://celebra-me.com/api/dashboard/admin/engagement/ranking';

beforeEach(() => {
	jest.clearAllMocks();
	mockAdminRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue(adminSession);
	mockRpc.mockResolvedValue([]);
});

describe('GET /api/dashboard/admin/engagement/ranking', () => {
	it('throttles, requires a strong admin session and returns a private report', async () => {
		const response = await getRanking(
			context(
				`${BASE}?eventType=boda&groupBy=rsvpAccessMode&metric=openRate&eventStatus=upcoming&includeDisabled=true`,
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as { ranking: Record<string, unknown> };
		expect(body.ranking).toMatchObject({
			eventType: 'boda',
			groupKey: 'rsvpAccessMode',
			metric: 'openRate',
			filters: { eventStatus: 'upcoming', includeDisabled: true },
			designs: [],
			invitations: [],
		});
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockAdminRateLimit).toHaveBeenCalledWith(expect.anything(), 'engagement:ranking');
		expect(mockStrongSession).toHaveBeenCalled();
		expect(mockRpc).toHaveBeenCalledWith('boda');
	});

	it('lists every event type by default and sorts by response rate', async () => {
		const response = await getRanking(context(BASE));
		expect(response.status).toBe(200);
		expect(mockRpc).toHaveBeenCalledWith(null);
		const body = (await response.json()) as { ranking: { eventType: string; metric: string } };
		expect(body.ranking).toMatchObject({ eventType: 'all', metric: 'responseRate' });
	});

	it('rejects an unknown event type, grouping, metric or filter with 400 before reading', async () => {
		for (const url of [
			`${BASE}?eventType=fiesta`,
			`${BASE}?groupBy=templateId`,
			`${BASE}?metric=reopenRatio`,
			`${BASE}?confirmation=sms`,
			`${BASE}?includeDisabled=yes`,
		]) {
			const response = await getRanking(context(url));
			expect(response.status).toBe(400);
		}
		expect(mockRpc).not.toHaveBeenCalled();
	});

	it('answers 503 while the ranking routine is missing in the database', async () => {
		mockRpc.mockRejectedValue(new SupabaseHttpError(404, '{"code":"PGRST202"}', 'PGRST202'));
		const response = await getRanking(context(`${BASE}?eventType=boda`));
		expect(response.status).toBe(503);
	});

	it('answers a host or weak session with 403 without reading', async () => {
		mockStrongSession.mockRejectedValue(new ApiError(403, 'forbidden', 'Sin acceso.'));
		const response = await getRanking(context(`${BASE}?eventType=boda`));
		expect(response.status).toBe(403);
		expect(mockRpc).not.toHaveBeenCalled();
	});
});
