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

import {
	createSalesOrder,
	registerSalesOrderDepositPurchase,
} from '@/lib/commercial/orders.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
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
