jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));

jest.mock('@/lib/commercial/orders.service', () => ({
	createCommercialSalesOrder: jest.fn(),
	markCommercialOrderDepositPaid: jest.fn(),
}));

jest.mock('@/lib/commercial/commercial-tracking', () => ({
	emitCommercialTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/commercial/orders.repository', () => ({
	findSalesOrdersByCustomerId: jest.fn(),
}));

import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import {
	createCommercialSalesOrder,
	markCommercialOrderDepositPaid,
} from '@/lib/commercial/orders.service';
import { findSalesOrdersByCustomerId } from '@/lib/commercial/orders.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import { POST as createOrder, GET as listOrders } from '@/pages/api/dashboard/commercial/orders';
import { POST as markDepositPaid } from '@/pages/api/dashboard/commercial/orders/[orderId]/deposit-paid';

const mockRequireAdminMutationAccess = requireAdminMutationAccess as jest.MockedFunction<
	typeof requireAdminMutationAccess
>;
const mockRequireAdminStrongSession = requireAdminStrongSession as jest.MockedFunction<
	typeof requireAdminStrongSession
>;
const mockCreateCommercialSalesOrder = createCommercialSalesOrder as jest.MockedFunction<
	typeof createCommercialSalesOrder
>;
const mockMarkCommercialOrderDepositPaid = markCommercialOrderDepositPaid as jest.MockedFunction<
	typeof markCommercialOrderDepositPaid
>;
const mockFindSalesOrdersByCustomerId = findSalesOrdersByCustomerId as jest.MockedFunction<
	typeof findSalesOrdersByCustomerId
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
	mockRequireAdminStrongSession.mockResolvedValue({
		userId: 'admin-user-id',
		isSuperAdmin: true,
	} as never);
	mockFindSalesOrdersByCustomerId.mockResolvedValue([
		{
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			sessionId: null,
			sourceEventId: null,
			status: 'confirmed',
			eventType: 'wedding',
			packageId: null,
			packageName: 'Premium',
			currency: 'MXN',
			totalAmount: 1699,
			depositAmount: 899,
			amountPaid: 0,
			depositPaidAt: null,
			paidAt: null,
		},
	]);
});

describe('/api/dashboard/commercial/orders', () => {
	beforeEach(() => {
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
	});

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
				idempotencyKey: '11111111-1111-4111-8111-111111111111',
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
	beforeEach(() => {
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

	it('marks the first deposit as paid and returns the pending Purchase outbox event', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/orders/order-id/deposit-paid',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					amountPaid: 899,
					paidAt: '2026-07-08T12:30:00.000Z',
					idempotencyKey: '22222222-2222-4222-8222-222222222222',
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
		expect(mockMarkCommercialOrderDepositPaid).toHaveBeenCalledWith(
			expect.objectContaining({
				orderId: 'order-id',
				amountPaid: 899,
				paidAt: '2026-07-08T12:30:00.000Z',
				idempotencyKey: '22222222-2222-4222-8222-222222222222',
			}),
		);
		expect(body.data.conversionEvent.eventId).toBe('purchase:order-id:deposit_paid');
	});

	it('rejects deposit paid when amount exceeds order total with controlled Spanish error', async () => {
		mockMarkCommercialOrderDepositPaid.mockRejectedValue(
			new ApiError(
				400,
				'validation_error',
				'El anticipo no puede ser mayor que el monto total de la orden.',
			),
		);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/orders/order-id/deposit-paid',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					amountPaid: 2000,
					paidAt: '2026-07-08T12:30:00.000Z',
					idempotencyKey: '22222222-2222-4222-8222-222222222222',
				}),
			},
		);

		const response = await markDepositPaid(
			createContext(request, { orderId: 'order-id' }) as never,
		);
		const body = await response.json();

		expect(body.success).toBe(false);
		expect(body.error.message).toContain(
			'El anticipo no puede ser mayor que el monto total de la orden.',
		);
		expect(body.data).toBeUndefined();
	});
});

describe('/api/dashboard/commercial/orders — GET', () => {
	it('returns camelCase-mapped orders for a valid customerId with admin session', async () => {
		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/orders?customerId=customer-id',
			{ method: 'GET' },
		);

		const response = await listOrders(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockRequireAdminStrongSession).toHaveBeenCalledWith(request);
		expect(mockFindSalesOrdersByCustomerId).toHaveBeenCalledWith('customer-id');
		// Verify camelCase mapping — raw Supabase returns snake_case
		expect(body.data[0].eventType).toBe('wedding');
		expect(body.data[0].totalAmount).toBe(1699);
		expect(body.data[0].amountPaid).toBe(0);
		expect(body.data[0].currency).toBe('MXN');
		expect(body.data[0].orderNumber).toBe('CMO-20260708-ABC123');
		expect(body.data[0].status).toBe('confirmed');
	});

	it('returns 400 when customerId is missing on GET', async () => {
		const request = new Request('https://www.celebra-me.com/api/dashboard/commercial/orders', {
			method: 'GET',
		});

		const response = await listOrders(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(mockFindSalesOrdersByCustomerId).not.toHaveBeenCalled();
		expect(body.error.code).toBe('bad_request');
	});

	it('returns empty array when no orders exist for the given customerId', async () => {
		mockFindSalesOrdersByCustomerId.mockResolvedValue([]);

		const request = new Request(
			'https://www.celebra-me.com/api/dashboard/commercial/orders?customerId=unknown-customer',
			{ method: 'GET' },
		);

		const response = await listOrders(createContext(request) as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual([]);
	});
});
