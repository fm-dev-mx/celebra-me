jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/admin-rate-limit', () => ({
	requireAdminRateLimit: jest.fn(),
}));

jest.mock('@/lib/tracking/commercial-pagination.server', () => ({
	loadCommercialRows: jest.fn(),
}));

jest.mock(
	'astro:content',
	() => ({
		getCollection: jest.fn(async () => [
			{ id: 'xv/demo-a', data: { eventType: 'xv', theme: { preset: 'celestial-blue' } } },
		]),
	}),
	{ virtual: true },
);

import type { SessionContext } from '@/lib/rsvp/auth/auth';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { loadCommercialRows } from '@/lib/tracking/commercial-pagination.server';
import { GET as getDemos } from '@/pages/api/dashboard/admin/engagement/demos';
import { createMockRequest } from '../helpers/api-mocks';

const mockStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockAdminRateLimit = requireAdminRateLimit as jest.MockedFunction<
	typeof requireAdminRateLimit
>;
const mockRows = loadCommercialRows as jest.MockedFunction<typeof loadCommercialRows>;

type RouteContext = Parameters<typeof getDemos>[0];

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

const BASE = 'https://celebra-me.com/api/dashboard/admin/engagement/demos';

beforeEach(() => {
	jest.clearAllMocks();
	mockAdminRateLimit.mockResolvedValue(undefined);
	mockStrongSession.mockResolvedValue(adminSession);
	mockRows.mockResolvedValue([
		{
			id: 'e1',
			session_id: 's1',
			event_name: 'demo_viewed',
			event_properties: { demo_slug: 'demo-a', event_type: 'xv' },
		},
	] as never);
});

describe('GET /api/dashboard/admin/engagement/demos', () => {
	it('reads only external demo traffic for the period behind a strong admin session', async () => {
		const response = await getDemos(
			context(`${BASE}?period=60&eventType=xv&sort=contactsPer100`),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockAdminRateLimit).toHaveBeenCalledWith(expect.anything(), 'engagement:demos');
		const query = mockRows.mock.calls[0]![0] as string;
		expect(query).toContain('route_class=eq.demo');
		expect(query).toContain('is_internal=eq.false');
		expect(query).toContain('occurred_at=gte.');
		const body = (await response.json()) as { demos: Record<string, unknown> };
		expect(body.demos).toMatchObject({
			period: 60,
			eventType: 'xv',
			sort: 'contactsPer100',
			minSessions: 100,
		});
		expect(body.demos.demos).toEqual([
			expect.objectContaining({
				slug: 'demo-a',
				sessions: 1,
				themePreset: 'celestial-blue',
				listed: true,
			}),
		]);
	});

	it('rejects an unknown period, event type or sort with 400 before reading', async () => {
		for (const url of [`${BASE}?period=7`, `${BASE}?eventType=fiesta`, `${BASE}?sort=leads`]) {
			const response = await getDemos(context(url));
			expect(response.status).toBe(400);
		}
		expect(mockRows).not.toHaveBeenCalled();
	});

	it('answers a host or weak session with 403 without reading', async () => {
		mockStrongSession.mockRejectedValue(new ApiError(403, 'forbidden', 'Sin acceso.'));
		const response = await getDemos(context(BASE));
		expect(response.status).toBe(403);
		expect(mockRows).not.toHaveBeenCalled();
	});
});
