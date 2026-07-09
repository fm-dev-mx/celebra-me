jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	processPendingMetaConversionEvents: jest.fn(),
	deliverMetaConversionEvent: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { requireAdminMutationAccess, requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { processPendingMetaConversionEvents, deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { POST, GET } from '@/pages/api/dashboard/commercial/meta-conversions/process';

const mockRequireAdminMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockRequireAdminStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockProcessPending = processPendingMetaConversionEvents as jest.MockedFunction<
	typeof processPendingMetaConversionEvents
>;
const mockDeliverMetaConversionEvent = deliverMetaConversionEvent as jest.MockedFunction<
	typeof deliverMetaConversionEvent
>;
const mockRestRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

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
	mockRequireAdminMutationAccess.mockResolvedValue({
		userId: 'admin-user-id',
		isSuperAdmin: true,
	} as never);
	mockRequireAdminStrongSession.mockResolvedValue({
		userId: 'admin-user-id',
		isSuperAdmin: true,
	} as never);
	mockProcessPending.mockResolvedValue({
		processed: 5,
		failed: 1,
		skipped: 0,
	});
	mockDeliverMetaConversionEvent.mockResolvedValue('sent');
	mockRestRequest.mockResolvedValue([
		{
			id: 'conv-id-1',
			event_name: 'Purchase',
			event_id: 'purchase:123',
			value: 899,
			currency: 'MXN',
			status: 'sent',
			created_at: '2026-07-08T12:00:00.000Z',
		},
	]);
});

describe('/api/dashboard/commercial/meta-conversions/process', () => {
	describe('POST', () => {
		it('runs batch process of pending conversions as an admin mutation', async () => {
			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/process',
				{ method: 'POST' },
			);

			const response = await POST(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(mockRequireAdminMutationAccess).toHaveBeenCalledWith(
				request,
				{},
				'commercial:meta-conversions:process',
			);
			expect(mockProcessPending).toHaveBeenCalledTimes(1);
			expect(body.data).toEqual({ processed: 5, failed: 1, skipped: 0 });
		});

		it('manually requeues and retries a specific conversion event when action is requeue', async () => {
			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/process',
				{
					method: 'POST',
					body: JSON.stringify({ action: 'requeue', eventId: 'target-event-id' }),
				},
			);

			const response = await POST(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(mockRequireAdminMutationAccess).toHaveBeenCalledWith(
				request,
				{},
				'commercial:meta-conversions:requeue',
			);
			expect(mockRestRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'PATCH',
					pathWithQuery: 'meta_conversion_events?id=eq.target-event-id',
					body: expect.objectContaining({
						status: 'pending',
						attempt_count: 0,
					}),
				}),
			);
			expect(mockDeliverMetaConversionEvent).toHaveBeenCalledWith('target-event-id');
			expect(body.data).toEqual({ eventId: 'target-event-id', status: 'sent' });
		});
	});

	describe('GET', () => {
		it('returns recent conversion logs under admin session', async () => {
			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/process',
				{ method: 'GET' },
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(mockRequireAdminStrongSession).toHaveBeenCalledWith(request);
			expect(mockRestRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'GET',
					pathWithQuery: expect.stringContaining('meta_conversion_events'),
				}),
			);
			expect(body.data[0].id).toBe('conv-id-1');
		});
	});
});
