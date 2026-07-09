jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
}));

jest.mock('@/lib/commercial/orders.service', () => ({
	createCommercialSalesOrder: jest.fn(),
	markCommercialOrderDepositPaid: jest.fn(),
}));

import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import {
	createCommercialSalesOrder,
	markCommercialOrderDepositPaid,
} from '@/lib/commercial/orders.service';
import { POST as createOrder } from '@/pages/api/dashboard/commercial/orders';
import { POST as markDepositPaid } from '@/pages/api/dashboard/commercial/orders/[orderId]/deposit-paid';

const mockRequireAdminMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockCreateCommercialSalesOrder = createCommercialSalesOrder as jest.MockedFunction<
	typeof createCommercialSalesOrder
>;
const mockMarkCommercialOrderDepositPaid = markCommercialOrderDepositPaid as jest.MockedFunction<
	typeof markCommercialOrderDepositPaid
>;

function createContext(request: Request, params: Record<string, string | undefined> = {}) {
	return {
		request,
		url: new URL(request.url),
		params,
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
	mockCreateCommercialSalesOrder.mockResolvedValue({
		id: 'order-id',
		orderNumber: 'CMO-20260708-ABC123',
		status: 'confirmed',
		customerId: 'customer-id',
		leadId: 'lead-id',
		sessionId: null,
		sourceEventId: null,
		eventType: 'wedding',
		packageId: null,
		packageName: 'Premium',
		currency: 'MXN',
		totalAmount: 1699,
		depositAmount: 899,
		amountPaid: 0,
		depositPaidAt: null,
		paidAt: null,
	});
	mockMarkCommercialOrderDepositPaid.mockResolvedValue({
		order: {
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			status: 'deposit_paid',
			customerId: 'customer-id',
			leadId: 'lead-id',
			sessionId: null,
			sourceEventId: null,
			eventType: 'wedding',
			packageId: null,
			packageName: 'Premium',
			currency: 'MXN',
			totalAmount: 1699,
			depositAmount: 899,
			amountPaid: 899,
			depositPaidAt: '2026-07-08T12:30:00.000Z',
			paidAt: null,
		},
		conversionEvent: {
			id: 'conversion-id',
			orderId: 'order-id',
			eventName: 'Purchase',
			eventId: 'purchase:order-id:deposit_paid',
			value: 899,
			currency: 'MXN',
			status: 'pending',
		},
	});
});

describe('/api/dashboard/commercial/orders', () => {
	it('creates a commercial sales order as an admin mutation', async () => {
		const request = new Request('https://www.celebra-me.com/api/dashboard/commercial/orders', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				customerId: 'customer-id',
				leadId: 'lead-id',
				eventType: 'wedding',
				packageName: 'Premium',
				totalAmount: 1699,
				depositAmount: 899,
			}),
		});

		const response = await createOrder(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockRequireAdminMutationAccess).toHaveBeenCalledWith(
			request,
			{},
			'commercial:orders:create',
		);
				expect(mockCreateCommercialSalesOrder).toHaveBeenCalledWith(
					expect.objectContaining({
						customerId: 'customer-id',
						leadId: 'lead-id',
						eventType: 'wedding',
						packageName: 'Premium',
						totalAmount: 1699,
						depositAmount: 899,
						createdBy: expect.any(String),
					}),
				);
		expect(body.data.orderNumber).toBe('CMO-20260708-ABC123');
	});

	it('rejects order creation when customerId is missing', async () => {
		const request = new Request('https://www.celebra-me.com/api/dashboard/commercial/orders', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				eventType: 'wedding',
				totalAmount: 1699,
			}),
		});

		const response = await createOrder(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(mockCreateCommercialSalesOrder).not.toHaveBeenCalled();
		expect(body.error.code).toBe('bad_request');
	});
});

describe('/api/dashboard/commercial/orders/[orderId]/deposit-paid', () => {
	it('marks the first deposit as paid and returns the pending Purchase outbox event', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/orders/order-id/deposit-paid',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					amountPaid: 899,
					paidAt: '2026-07-08T12:30:00.000Z',
				}),
			},
		);

		const response = await markDepositPaid(
			createContext(request, { orderId: 'order-id' }) as never,
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockRequireAdminMutationAccess).toHaveBeenCalledWith(
			request,
			{},
			'commercial:orders:deposit-paid',
		);
		expect(mockMarkCommercialOrderDepositPaid).toHaveBeenCalledWith({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-08T12:30:00.000Z',
		});
		expect(body.data.conversionEvent.eventId).toBe('purchase:order-id:deposit_paid');
	});
});
