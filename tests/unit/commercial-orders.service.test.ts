jest.mock('@/lib/commercial/orders.repository', () => ({
	createSalesOrder: jest.fn(),
	findSalesOrderById: jest.fn(),
	updateSalesOrderDepositPaid: jest.fn(),
	findMetaConversionEventByEventId: jest.fn(),
	upsertMetaConversionEvent: jest.fn(),
}));

jest.mock('@/lib/commercial/meta-capi/service', () => ({
	deliverMetaConversionEvent: jest.fn(),
}));

import {
	createSalesOrder,
	findMetaConversionEventByEventId,
	findSalesOrderById,
	updateSalesOrderDepositPaid,
	upsertMetaConversionEvent,
} from '@/lib/commercial/orders.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import {
	createCommercialSalesOrder,
	markCommercialOrderDepositPaid,
} from '@/lib/commercial/orders.service';

const mockCreateSalesOrder = createSalesOrder as jest.MockedFunction<typeof createSalesOrder>;
const mockFindSalesOrderById = findSalesOrderById as jest.MockedFunction<typeof findSalesOrderById>;
const mockUpdateSalesOrderDepositPaid = updateSalesOrderDepositPaid as jest.MockedFunction<
	typeof updateSalesOrderDepositPaid
>;
const mockFindMetaConversionEventByEventId =
	findMetaConversionEventByEventId as jest.MockedFunction<
		typeof findMetaConversionEventByEventId
	>;
const mockUpsertMetaConversionEvent = upsertMetaConversionEvent as jest.MockedFunction<
	typeof upsertMetaConversionEvent
>;
const mockDeliverMetaConversionEvent = deliverMetaConversionEvent as jest.MockedFunction<
	typeof deliverMetaConversionEvent
>;

beforeEach(() => {
	jest.clearAllMocks();
	mockDeliverMetaConversionEvent.mockResolvedValue('sent');

	mockCreateSalesOrder.mockResolvedValue({
		id: 'order-id',
		orderNumber: 'CMO-20260708-ABC123',
		customerId: 'customer-id',
		status: 'confirmed',
		currency: 'MXN',
		totalAmount: 1800,
		amountPaid: 0,
	});
	mockFindSalesOrderById.mockResolvedValue({
		id: 'order-id',
		orderNumber: 'CMO-20260708-ABC123',
		customerId: 'customer-id',
		leadId: 'lead-id',
		status: 'confirmed',
		currency: 'MXN',
		totalAmount: 1800,
		amountPaid: 0,
	});
	mockUpdateSalesOrderDepositPaid.mockResolvedValue({
		id: 'order-id',
		orderNumber: 'CMO-20260708-ABC123',
		customerId: 'customer-id',
		leadId: 'lead-id',
		status: 'deposit_paid',
		currency: 'MXN',
		totalAmount: 1800,
		amountPaid: 899,
		depositPaidAt: '2026-07-08T14:00:00.000Z',
	});
	mockFindMetaConversionEventByEventId.mockResolvedValue(null);
	mockUpsertMetaConversionEvent.mockResolvedValue({
		id: 'conversion-id',
		eventId: 'purchase:order-id:deposit_paid',
		eventName: 'Purchase',
		status: 'pending',
		value: 899,
		currency: 'MXN',
	});
});

describe('createCommercialSalesOrder', () => {
	it('creates an order without enqueueing a Meta Purchase event', async () => {
		const order = await createCommercialSalesOrder({
			customerId: 'customer-id',
			leadId: 'lead-id',
			eventType: 'xv',
			packageId: 'premium',
			packageName: 'Premium',
			totalAmount: 1800,
			depositAmount: 899,
			createdBy: 'admin-user-id',
		});

		expect(order.status).toBe('confirmed');
		expect(mockCreateSalesOrder).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: 'customer-id',
				leadId: 'lead-id',
				status: 'confirmed',
				currency: 'MXN',
				totalAmount: 1800,
				depositAmount: 899,
			}),
		);
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('rejects non-MXN order currency', async () => {
		await expect(
			createCommercialSalesOrder({
				customerId: 'customer-id',
				eventType: 'xv',
				currency: 'USD',
				totalAmount: 1800,
			}),
		).rejects.toThrow('Commercial sales orders must use MXN currency.');

		expect(mockCreateSalesOrder).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});
});

describe('markCommercialOrderDepositPaid', () => {
	it('updates the order and enqueues one pending Purchase outbox row for the first deposit payment', async () => {
		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-08T14:00:00.000Z',
		});

		expect(mockUpdateSalesOrderDepositPaid).toHaveBeenCalledWith({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-08T14:00:00.000Z',
		});
		expect(mockUpsertMetaConversionEvent).toHaveBeenCalledWith({
			orderId: 'order-id',
			leadId: 'lead-id',
			customerId: 'customer-id',
			eventName: 'Purchase',
			eventId: 'purchase:order-id:deposit_paid',
			triggerStatus: 'deposit_paid',
			value: 899,
			currency: 'MXN',
		});
		expect(mockDeliverMetaConversionEvent).toHaveBeenCalledWith('conversion-id');
		expect(result.conversionEvent?.eventId).toBe('purchase:order-id:deposit_paid');
	});

	it('uses MXN for Purchase outbox even if the stored order currency is malformed', async () => {
		mockUpdateSalesOrderDepositPaid.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'deposit_paid',
			currency: 'USD',
			totalAmount: 1800,
			amountPaid: 899,
			depositPaidAt: '2026-07-08T14:00:00.000Z',
		});

		await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-08T14:00:00.000Z',
		});

		expect(mockUpsertMetaConversionEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				value: 899,
				currency: 'MXN',
			}),
		);
	});

	it('returns the existing outbox row without enqueueing a duplicate for repeated deposit_paid', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'deposit_paid',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 899,
			depositPaidAt: '2026-07-08T14:00:00.000Z',
		});
		mockFindMetaConversionEventByEventId.mockResolvedValue({
			id: 'existing-conversion-id',
			eventId: 'purchase:order-id:deposit_paid',
			eventName: 'Purchase',
			status: 'pending',
			value: 899,
			currency: 'MXN',
		});

		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 899,
			paidAt: '2026-07-08T15:00:00.000Z',
		});

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
		expect(result.conversionEvent?.id).toBe('existing-conversion-id');
	});

	it('does not enqueue Purchase for non-positive payment amounts', async () => {
		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'order-id',
				amountPaid: 0,
				paidAt: '2026-07-08T14:00:00.000Z',
			}),
		).rejects.toThrow('El monto del anticipo debe ser mayor a cero.');

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('throws when the sales order is not found', async () => {
		mockFindSalesOrderById.mockResolvedValue(null);

		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'nonexistent-order',
				amountPaid: 899,
				paidAt: '2026-07-08T14:00:00.000Z',
			}),
		).rejects.toThrow('No se encontró la orden de venta.');

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('rejects deposit_paid for a cancelled order', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'cancelled',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 0,
		});

		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'order-id',
				amountPaid: 899,
			}),
		).rejects.toThrow(/no se puede registrar un anticipo en una orden con estado "cancelled"/i);

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('rejects deposit_paid for a lost order', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'lost',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 0,
		});

		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'order-id',
				amountPaid: 899,
			}),
		).rejects.toThrow(/no se puede registrar un anticipo en una orden con estado "lost"/i);

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('rejects deposit_paid for a draft order', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'draft',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 0,
		});

		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'order-id',
				amountPaid: 899,
			}),
		).rejects.toThrow(/no se puede registrar un anticipo en una orden con estado "draft"/i);

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('rejects deposit larger than the order total', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'confirmed',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 0,
		});

		await expect(
			markCommercialOrderDepositPaid({
				orderId: 'order-id',
				amountPaid: 2000,
			}),
		).rejects.toThrow('El anticipo no puede ser mayor que el monto total de la orden.');

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
		expect(mockFindMetaConversionEventByEventId).not.toHaveBeenCalled();
	});

	it('allows deposit equal to the order total', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'confirmed',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 0,
		});

		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 1800,
			paidAt: '2026-07-08T14:00:00.000Z',
		});

		expect(mockUpdateSalesOrderDepositPaid).toHaveBeenCalledWith({
			orderId: 'order-id',
			amountPaid: 1800,
			paidAt: '2026-07-08T14:00:00.000Z',
		});
		expect(mockUpsertMetaConversionEvent).toHaveBeenCalledWith(
			expect.objectContaining({ value: 1800 }),
		);
		expect(result.order.status).toBe('deposit_paid');
	});

	it('does not create a second Purchase when order is already paid', async () => {
		mockFindSalesOrderById.mockResolvedValue({
			id: 'order-id',
			orderNumber: 'CMO-20260708-ABC123',
			customerId: 'customer-id',
			leadId: 'lead-id',
			status: 'paid',
			currency: 'MXN',
			totalAmount: 1800,
			amountPaid: 1800,
			paidAt: '2026-07-08T16:00:00.000Z',
		});
		mockFindMetaConversionEventByEventId.mockResolvedValue({
			id: 'existing-conversion-id',
			eventId: 'purchase:order-id:deposit_paid',
			eventName: 'Purchase',
			status: 'sent',
			value: 899,
			currency: 'MXN',
		});

		const result = await markCommercialOrderDepositPaid({
			orderId: 'order-id',
			amountPaid: 1800,
		});

		expect(mockUpdateSalesOrderDepositPaid).not.toHaveBeenCalled();
		expect(mockUpsertMetaConversionEvent).not.toHaveBeenCalled();
		expect(result.order.status).toBe('paid');
		expect(result.conversionEvent?.status).toBe('sent');
	});
});
