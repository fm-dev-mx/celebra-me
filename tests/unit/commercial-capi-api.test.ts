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

import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import {
	processPendingMetaConversionEvents,
	deliverMetaConversionEvent,
} from '@/lib/commercial/meta-capi/service';
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
		ambiguous: 0,
	});
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
			expect(body.data).toEqual({ processed: 5, failed: 1, skipped: 0, ambiguous: 0 });
		});

		it('manually requeues and retries a specific conversion event when action is requeue', async () => {
			mockDeliverMetaConversionEvent.mockResolvedValue('sent');
			mockRestRequest.mockResolvedValueOnce([{ id: 'target-event-id', status: 'pending' }]);
			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/process',
				{
					method: 'POST',
					body: JSON.stringify({
						action: 'requeue',
						eventId: 'target-event-id',
						reason: 'Revisión operativa aprobada',
					}),
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
					method: 'POST',
					pathWithQuery: 'rpc/recover_meta_conversion_event',
					body: expect.objectContaining({
						p_event_id: 'target-event-id',
						p_reason: 'Revisión operativa aprobada',
					}),
				}),
			);
			expect(mockDeliverMetaConversionEvent).not.toHaveBeenCalled();
			expect(body.data).toEqual({ eventId: 'target-event-id', status: 'pending' });
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
					pathWithQuery: expect.stringContaining('meta_conversion_events'),
				}),
			);
			expect(body.data[0].id).toBe('conv-id-1');
		});

		it('returns response with camelCase fields (eventName, eventId, etc.)', async () => {
			mockRestRequest.mockResolvedValue([
				{
					id: 'conv-id-2',
					event_name: 'Purchase',
					event_id: 'purchase:order-2:deposit_paid',
					value: 1299,
					currency: 'MXN',
					status: 'pending',
					attempt_count: 0,
					last_error_message: null,
					created_at: '2026-07-08T12:00:00.000Z',
				},
			]);

			const request = new Request(
				'https://www.celebra-me.com/api/dashboard/commercial/meta-conversions/process',
				{ method: 'GET' },
			);

			const response = await GET(createContext(request) as never);
			const body = await response.json();

			expect(response.status).toBe(200);
			// Should have camelCase fields
			expect(body.data[0].eventName).toBe('Purchase');
			expect(body.data[0].eventId).toBe('purchase:order-2:deposit_paid');
			expect(body.data[0].attemptCount).toBe(0);
			expect(body.data[0].createdAt).toBe('2026-07-08T12:00:00.000Z');
			// Should also retain snake_case for backward compatibility
			expect(body.data[0].event_name).toBe('Purchase');
			expect(body.data[0].event_id).toBe('purchase:order-2:deposit_paid');
		});
	});
});
