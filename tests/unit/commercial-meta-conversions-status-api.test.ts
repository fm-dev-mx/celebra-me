jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { ApiError } from '@/lib/rsvp/core/errors';
import { GET } from '@/pages/api/dashboard/commercial/meta-conversions/status';

const mockRequireAdminStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockSupabaseRestRequest = supabaseRestRequest as jest.MockedFunction<
	typeof supabaseRestRequest
>;

function createContext(request: Request) {
	return {
		request,
		url: new URL(request.url),
		params: {},
		props: {},
		locals: {},
		cookies: {} as never,
		redirect: jest.fn() as never,
		rewrite: jest.fn() as never,
		site: undefined,
		generator: 'Astro',
		clientAddress: '127.0.0.1',
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockRequireAdminStrongSession.mockResolvedValue({ isSuperAdmin: true } as never);
});

describe('/api/dashboard/commercial/meta-conversions/status', () => {
	it('returns status for valid conversion event', async () => {
		mockSupabaseRestRequest.mockResolvedValueOnce([
			{ id: 'conv-1', status: 'sent' },
		]);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status?id=conv-1',
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.status).toBe('sent');
		expect(mockSupabaseRestRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: expect.stringContaining('meta_conversion_events?id=eq.conv-1'),
			}),
		);
	});

	it('returns 404 when conversion event not found', async () => {
		mockSupabaseRestRequest.mockResolvedValueOnce([]);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status?id=nonexistent',
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.success).toBe(false);
	});

	it('rejects without id param', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status',
		);

		const response = await GET(createContext(request) as never);

		expect(response.status).toBe(400);
		expect(mockSupabaseRestRequest).not.toHaveBeenCalled();
	});

	it('authorization: unauthenticated *** 401/403', async () => {
		mockRequireAdminStrongSession.mockRejectedValueOnce(
			new ApiError(401, 'unauthorized', 'Unauthorized.'),
		);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status?id=some-uuid',
			{ method: 'GET' },
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBeGreaterThanOrEqual(401);
		expect(response.status).toBeLessThanOrEqual(403);
		expect(body.success).toBe(false);
		expect(mockSupabaseRestRequest).not.toHaveBeenCalled();
	});

	it('authorization: insufficient *** → 403', async () => {
		mockRequireAdminStrongSession.mockRejectedValueOnce(
			new ApiError(403, 'forbidden', 'Not authorized for strong admin access.'),
		);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status?id=some-uuid',
			{ method: 'GET' },
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.success).toBe(false);
		expect(mockSupabaseRestRequest).not.toHaveBeenCalled();
	});

	it('authorization: valid *** → 200', async () => {
		mockSupabaseRestRequest.mockResolvedValueOnce([
			{ id: 'conv-1', status: 'pending' },
		]);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/status?id=conv-1',
		);

		const response = await GET(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.status).toBe('pending');
	});
});
