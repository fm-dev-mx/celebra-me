jest.mock('@/lib/commercial/orders.repository', () => ({
	createSalesOrder: jest.fn(),
	registerSalesOrderDepositPurchase: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	deliverMetaConversionEvent: jest.fn(),
}));

jest.mock('@/lib/commercial/commercial-tracking', () => ({
	emitCommercialTrackingEvent: jest.fn(),
}));

jest.mock('@/lib/tracking/lead.repository', () => ({
	findLeadOrderAttribution: jest.fn(),
}));

import {
	createSalesOrder,
	registerSalesOrderDepositPurchase,
} from '@/lib/commercial/orders.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { emitCommercialTrackingEvent } from '@/lib/commercial/commercial-tracking';
import { findLeadOrderAttribution } from '@/lib/tracking/lead.repository';
import {
	createCommercialSalesOrder,
	markCommercialOrderDepositPaid,
} from '@/lib/commercial/orders.service';

const mockCreateSalesOrder = createSalesOrder as jest.MockedFunction<typeof createSalesOrder>;
const mockRegisterDeposit = registerSalesOrderDepositPurchase as jest.MockedFunction<
	typeof registerSalesOrderDepositPurchase
>;
const mockDeliver = deliverMetaConversionEvent as jest.MockedFunction<
	typeof deliverMetaConversionEvent
>;
const mockEmitTracking = emitCommercialTrackingEvent as jest.MockedFunction<
	typeof emitCommercialTrackingEvent
>;
const mockFindAttribution = jest.mocked(findLeadOrderAttribution);

const order = {
	id: 'order-id',
	orderNumber: 'CMO-20260711-ABC123',
	customerId: 'customer-id',
	leadId: 'lead-id',
	status: 'deposit_paid' as const,
	currency: 'MXN',
	totalAmount: 1800,
	amountPaid: 899,
	depositPaidAt: '2026-07-11T18:00:00.000Z',
};

const conversionEvent = {
	id: 'conversion-id',
	orderId: 'order-id',
	eventId: 'purchase:order-id:deposit_paid',
	eventName: 'Purchase' as const,
	status: 'pending' as const,
	value: 899,
	currency: 'MXN',
};

beforeEach(() => {
	jest.clearAllMocks();
	mockCreateSalesOrder.mockResolvedValue({ ...order, status: 'confirmed', amountPaid: 0 });
	mockRegisterDeposit.mockResolvedValue({ order, conversionEvent, idempotent: false });
	mockDeliver.mockResolvedValue('sent');
	mockFindAttribution.mockResolvedValue(null);
});

describe('createCommercialSalesOrder', () => {
	it('passes the business idempotency key to order persistence', async () => {
		await createCommercialSalesOrder({
			customerId: 'customer-id',
			eventType: 'xv',
			totalAmount: 1800,
			idempotencyKey: '11111111-1111-4111-8111-111111111111',
		});

		expect(mockCreateSalesOrder).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: '11111111-1111-4111-8111-111111111111',
				currency: 'MXN',
				status: 'confirmed',
			}),
		);
	});

	it("links the order to the customer's latest lead and its session for Purchase attribution", async () => {
		mockFindAttribution.mockResolvedValue({ leadId: 'lead-id', sessionId: 'session-id' });

		await createCommercialSalesOrder({
			customerId: 'customer-id',
			eventType: 'xv',
			totalAmount: 1800,
		});

		expect(mockFindAttribution).toHaveBeenCalledWith({
			leadId: undefined,
			customerId: 'customer-id',
		});
		expect(mockCreateSalesOrder).toHaveBeenCalledWith(
			expect.objectContaining({ leadId: 'lead-id', sessionId: 'session-id' }),
		);
	});

	it('keeps an explicit session without looking up the lead', async () => {
		await createCommercialSalesOrder({
			customerId: 'customer-id',
			leadId: 'given-lead',
			sessionId: 'given-session',
			eventType: 'xv',
			totalAmount: 1800,
		});

		expect(mockFindAttribution).not.toHaveBeenCalled();
		expect(mockCreateSalesOrder).toHaveBeenCalledWith(
			expect.objectContaining({ leadId: 'given-lead', sessionId: 'given-session' }),
		);
	});

	it('rejects non-MXN orders', async () => {
		await expect(
			createCommercialSalesOrder({
				customerId: 'customer-id',
				eventType: 'xv',
				totalAmount: 1800,
				currency: 'USD',
			}),
		).rejects.toThrow('Commercial sales orders must use MXN currency.');
	});
});

describe('markCommercialOrderDepositPaid', () => {
	it('delegates the complete transition to the atomic RPC and starts delivery once', async () => {
		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-11T18:00:00.000Z',
			actorId: '22222222-2222-4222-8222-222222222222',
			idempotencyKey: '33333333-3333-4333-8333-333333333333',
		});

		expect(mockRegisterDeposit).toHaveBeenCalledWith({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-11T18:00:00.000Z',
			actorId: '22222222-2222-4222-8222-222222222222',
			idempotencyKey: '33333333-3333-4333-8333-333333333333',
		});
		expect(mockDeliver).toHaveBeenCalledWith('conversion-id');
		expect(result).toEqual({ order, conversionEvent });
	});

	it('keeps CAPI delivery and the tracking event alive through the after-response context', async () => {
		const waitUntil = jest.fn();

		await markCommercialOrderDepositPaid(
			{
				orderId: 'order-id',
				amountPaid: 899,
				idempotencyKey: '33333333-3333-4333-8333-333333333333',
			},
			{ after: { waitUntil } },
		);

		expect(mockDeliver).toHaveBeenCalledWith('conversion-id');
		expect(mockEmitTracking).toHaveBeenCalledWith(
			expect.objectContaining({ eventName: 'deposit_paid', orderId: 'order-id' }),
		);
		expect(waitUntil).toHaveBeenCalledTimes(2);
		await expect(Promise.all(waitUntil.mock.calls.map((call) => call[0]))).resolves.toEqual([
			undefined,
			undefined,
		]);
	});

	it('does not redeliver an idempotent retry', async () => {
		mockRegisterDeposit.mockResolvedValue({ order, conversionEvent, idempotent: true });

		await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 899,
			idempotencyKey: '33333333-3333-4333-8333-333333333333',
		});

		expect(mockDeliver).not.toHaveBeenCalled();
	});

	it('rejects a non-positive amount before calling the database', async () => {
		await expect(
			markCommercialOrderDepositPaid({ orderId: 'order-id', amountPaid: 0 }),
		).rejects.toThrow('El monto del anticipo debe ser mayor a cero.');
		expect(mockRegisterDeposit).not.toHaveBeenCalled();
	});
});
