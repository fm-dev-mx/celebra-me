import { ApiError } from '@/lib/rsvp/core/errors';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { loadCrmTimeline } from '@/lib/commercial/crm-timeline.service';
import { GET } from '@/pages/api/dashboard/commercial/timeline';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/commercial/crm-timeline.service', () => ({
	loadCrmTimeline: jest.fn(),
}));

const requireAdminStrongSessionMock = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const loadCrmTimelineMock = loadCrmTimeline as jest.MockedFunction<typeof loadCrmTimeline>;

describe('GET /api/dashboard/commercial/timeline', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		requireAdminStrongSessionMock.mockResolvedValue({
			userId: 'admin-id',
			email: 'admin@example.com',
			accessToken: 'access-token',
			role: 'super_admin',
			isSuperAdmin: true,
		});
		});

	it('returns a structured 400 response when customerId is missing', async () => {
		const response = await GET({
			request: createMockRequest(undefined, undefined, 'http://localhost/api/dashboard/commercial/timeline'),
			url: new URL('http://localhost/api/dashboard/commercial/timeline'),
		} as never);

		expect(response.status).toBe(400);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual({
			success: false,
			error: { code: 'bad_request', message: 'customerId is required.' },
		});
		expect(loadCrmTimelineMock).not.toHaveBeenCalled();
		});

	it('returns a timeline for a valid customerId', async () => {
		loadCrmTimelineMock.mockResolvedValue([]);
		const response = await GET({
			request: createMockRequest(undefined, undefined, 'http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
			url: new URL('http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, data: [] });
		expect(loadCrmTimelineMock).toHaveBeenCalledWith('customer-id');
		});

	it('preserves unexpected service failures as structured 500 responses', async () => {
		loadCrmTimelineMock.mockRejectedValue(new Error('database unavailable'));
		const response = await GET({
			request: createMockRequest(undefined, undefined, 'http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
			url: new URL('http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
		} as never);

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			success: false,
			error: { code: 'internal_error' },
		});
		});

	it('preserves authorization failures', async () => {
		requireAdminStrongSessionMock.mockRejectedValue(new ApiError(401, 'unauthorized', 'No session.'));
		const response = await GET({
			request: createMockRequest(undefined, undefined, 'http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
			url: new URL('http://localhost/api/dashboard/commercial/timeline?customerId=customer-id'),
		} as never);

		expect(response.status).toBe(401);
		});
});
