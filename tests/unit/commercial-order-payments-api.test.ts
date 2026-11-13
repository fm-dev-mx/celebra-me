/**
 * @jest-environment node
 */
jest.mock('@/lib/rsvp/auth/authorization', () => ({
	requireAdminMutationAccess: jest.fn(),
	requireAdminStrongSession: jest.fn(),
}));
jest.mock('@/lib/commercial/orders.service', () => ({
	registerCommercialOrderPayment: jest.fn(),
	getCommercialOrderDetail: jest.fn(),
	updateCommercialOrderEventDate: jest.fn(),
}));

import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import {
	getCommercialOrderDetail,
	registerCommercialOrderPayment,
	updateCommercialOrderEventDate,
} from '@/lib/commercial/orders.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { POST as postPayment } from '@/pages/api/dashboard/commercial/orders/[orderId]/payments';
import {
	GET as getDetail,
	PATCH as patchDetail,
} from '@/pages/api/dashboard/commercial/orders/[orderId]/detail';
import { createApiContext, createMockRequest } from '../helpers/api-mocks';

const ORDER_ID = '8f14e45f-ceea-4672-9a3d-1b2c3d4e5f60';
const KEY = '0b9d3c1e-1d2f-4a6b-8c7d-9e0f1a2b3c4d';

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(requireAdminMutationAccess).mockResolvedValue({ userId: 'admin-id' } as never);
	jest.mocked(requireAdminStrongSession).mockResolvedValue({ userId: 'admin-id' } as never);
});

describe('POST /orders/[orderId]/payments', () => {
	it('records the payment with the acting admin and the idempotency key', async () => {
		jest.mocked(registerCommercialOrderPayment).mockResolvedValue({
			order: { id: ORDER_ID },
			payment: { id: 'p1' },
		} as never);
		const request = createMockRequest({ amount: 400, idempotencyKey: KEY });
		const response = await postPayment(
			createApiContext(request, { orderId: ORDER_ID }) as never,
		);
		expect(response.status).toBe(200);
		expect(requireAdminMutationAccess).toHaveBeenCalledWith(
			request,
			{},
			'commercial:orders:payments',
		);
		expect(registerCommercialOrderPayment).toHaveBeenCalledWith(
			{
				orderId: ORDER_ID,
				amount: 400,
				paidAt: undefined,
				actorId: 'admin-id',
				idempotencyKey: KEY,
			},
			{ after: null },
		);
	});

	it.each([
		['a zero amount', { amount: 0, idempotencyKey: KEY }, ORDER_ID],
		['a missing key', { amount: 10 }, ORDER_ID],
		['an invalid order id', { amount: 10, idempotencyKey: KEY }, 'not-a-uuid'],
	])('rejects %s', async (_label, body, orderId) => {
		const response = await postPayment(
			createApiContext(createMockRequest(body), { orderId }) as never,
		);
		expect(response.status).toBe(400);
		expect(registerCommercialOrderPayment).not.toHaveBeenCalled();
	});

	it('surfaces a service conflict', async () => {
		jest.mocked(registerCommercialOrderPayment).mockRejectedValue(
			new ApiError(409, 'conflict', 'datos diferentes'),
		);
		const response = await postPayment(
			createApiContext(createMockRequest({ amount: 10, idempotencyKey: KEY }), {
				orderId: ORDER_ID,
			}) as never,
		);
		expect(response.status).toBe(409);
	});

	it('stops when the admin session is not valid', async () => {
		jest.mocked(requireAdminMutationAccess).mockRejectedValue(
			new ApiError(401, 'unauthorized', 'No autorizado'),
		);
		const response = await postPayment(
			createApiContext(createMockRequest({ amount: 10, idempotencyKey: KEY }), {
				orderId: ORDER_ID,
			}) as never,
		);
		expect(response.status).toBe(401);
		expect(registerCommercialOrderPayment).not.toHaveBeenCalled();
	});
});

describe('GET and PATCH /orders/[orderId]/detail', () => {
	it('returns the detail with a private cache header', async () => {
		jest.mocked(getCommercialOrderDetail).mockResolvedValue({
			order: { id: ORDER_ID },
		} as never);
		const response = await getDetail(
			createApiContext(createMockRequest(), { orderId: ORDER_ID }) as never,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toMatch(/private/);
	});

	it('rejects an invalid order id', async () => {
		const response = await getDetail(
			createApiContext(createMockRequest(), { orderId: 'nope' }) as never,
		);
		expect(response.status).toBe(400);
	});

	it('sets and clears the event date', async () => {
		jest.mocked(updateCommercialOrderEventDate).mockResolvedValue({ id: ORDER_ID } as never);
		for (const eventDate of ['2027-03-20', null]) {
			const response = await patchDetail(
				createApiContext(createMockRequest({ eventDate }), { orderId: ORDER_ID }) as never,
			);
			expect(response.status).toBe(200);
			expect(updateCommercialOrderEventDate).toHaveBeenLastCalledWith(ORDER_ID, eventDate);
		}
	});

	it('rejects a malformed event date', async () => {
		const response = await patchDetail(
			createApiContext(createMockRequest({ eventDate: '20/03/2027' }), {
				orderId: ORDER_ID,
			}) as never,
		);
		expect(response.status).toBe(400);
		expect(updateCommercialOrderEventDate).not.toHaveBeenCalled();
	});
});
