jest.mock('@/lib/commercial/orders.repository', () => ({
	registerSalesOrderPayment: jest.fn(),
	findSalesOrderById: jest.fn(),
	listSalesOrderPayments: jest.fn(),
	findOrderProductionSources: jest.fn(),
	setSalesOrderEventDate: jest.fn(),
}));
jest.mock('@/lib/commercial/customer.repository', () => ({}));
jest.mock('@/lib/commercial/meta-capi/service', () => ({ deliverMetaConversionEvent: jest.fn() }));
jest.mock('@/lib/commercial/commercial-tracking', () => ({
	emitCommercialTrackingEvent: jest.fn(),
}));
jest.mock('@/lib/tracking/lead.repository', () => ({}));
jest.mock('@/lib/commercial/meta-capi/lead-stage-events', () => ({
	enqueueMetaCrmLeadStageEvent: jest.fn(),
}));
jest.mock('@/lib/commercial/meta-capi/order-settled', () => ({
	enqueueOrderSettledEvent: jest.fn().mockResolvedValue('settled-event-id'),
}));

import {
	findOrderProductionSources,
	findSalesOrderById,
	listSalesOrderPayments,
	registerSalesOrderPayment,
	setSalesOrderEventDate,
} from '@/lib/commercial/orders.repository';
import { deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { enqueueOrderSettledEvent } from '@/lib/commercial/meta-capi/order-settled';
import {
	getCommercialOrderDetail,
	registerCommercialOrderPayment,
	updateCommercialOrderEventDate,
} from '@/lib/commercial/orders.service';

const mockRegister = jest.mocked(registerSalesOrderPayment);
const mockFind = jest.mocked(findSalesOrderById);
const mockPayments = jest.mocked(listSalesOrderPayments);
const mockSources = jest.mocked(findOrderProductionSources);
const mockSetDate = jest.mocked(setSalesOrderEventDate);

const input = {
	orderId: 'order-id',
	amount: 400,
	paidAt: '2026-11-10T19:00:00.000Z',
	actorId: 'admin-id',
	idempotencyKey: 'key-1',
};

beforeEach(() => jest.clearAllMocks());

describe('registerCommercialOrderPayment', () => {
	it('records an installment through the atomic RPC and sends no Meta event', async () => {
		mockRegister.mockResolvedValue({
			order: { id: 'order-id', amountPaid: 800, totalAmount: 1800, isPastSale: false },
			payment: { id: 'p1' },
		} as never);
		const waitUntil = jest.fn();
		const result = await registerCommercialOrderPayment(input, { after: { waitUntil } });
		expect(mockRegister).toHaveBeenCalledWith(input);
		expect(result.payment).toEqual({ id: 'p1' });
		expect(waitUntil).not.toHaveBeenCalled();
		expect(enqueueOrderSettledEvent).not.toHaveBeenCalled();
		expect(deliverMetaConversionEvent).not.toHaveBeenCalled();
	});

	it('queues and delivers OrderSettled when the payment settles the balance', async () => {
		mockRegister.mockResolvedValue({
			order: {
				id: 'order-id',
				customerId: 'customer-id',
				leadId: 'lead-id',
				amountPaid: 1800,
				totalAmount: 1800,
				isPastSale: false,
			},
			payment: { id: 'p2' },
		} as never);
		const waitUntil = jest.fn();
		await registerCommercialOrderPayment(input, { after: { waitUntil } });
		expect(waitUntil).toHaveBeenCalledTimes(1);
		await Promise.all(waitUntil.mock.calls.map((call) => call[0]));
		expect(enqueueOrderSettledEvent).toHaveBeenCalledWith({
			orderId: 'order-id',
			customerId: 'customer-id',
			leadId: 'lead-id',
		});
		expect(deliverMetaConversionEvent).toHaveBeenCalledWith('settled-event-id');
	});

	it('rejects a non positive amount before calling the database', async () => {
		await expect(registerCommercialOrderPayment({ ...input, amount: 0 })).rejects.toThrow();
		expect(mockRegister).not.toHaveBeenCalled();
	});

	it.each([
		['No se encontró la orden de venta.', 404],
		['La clave de idempotencia ya se usó con datos diferentes.', 409],
		['El pago no puede superar el saldo pendiente.', 400],
		['No se puede registrar un pago en este estado.', 400],
	])('maps "%s" to HTTP %i', async (message, status) => {
		mockRegister.mockRejectedValue(new Error(message));
		await expect(registerCommercialOrderPayment(input)).rejects.toMatchObject({ status });
	});

	it('rethrows unknown errors untouched', async () => {
		const failure = new Error('connection reset');
		mockRegister.mockRejectedValue(failure);
		await expect(registerCommercialOrderPayment(input)).rejects.toBe(failure);
	});
});

describe('getCommercialOrderDetail', () => {
	it('returns the order, its payments and the derived stage line', async () => {
		mockFind.mockResolvedValue({
			id: 'order-id',
			status: 'deposit_paid',
			amountPaid: 500,
		} as never);
		mockPayments.mockResolvedValue([{ id: 'p1' }] as never);
		mockSources.mockResolvedValue({ dataRequestStatus: 'submitted', invitationStatus: null });
		const detail = await getCommercialOrderDetail('order-id');
		expect(detail.payments).toHaveLength(1);
		expect(detail.stages.current).toBe('data_received');
		expect(detail.stages.steps).toHaveLength(7);
	});

	it('answers 404 when the order does not exist', async () => {
		mockFind.mockResolvedValue(null);
		mockPayments.mockResolvedValue([]);
		mockSources.mockResolvedValue({ dataRequestStatus: null, invitationStatus: null });
		await expect(getCommercialOrderDetail('missing')).rejects.toMatchObject({ status: 404 });
	});
});

describe('updateCommercialOrderEventDate', () => {
	it('stores or clears the event date and answers 404 for an unknown order', async () => {
		mockSetDate.mockResolvedValueOnce({ id: 'order-id', eventDate: '2027-03-20' } as never);
		await expect(
			updateCommercialOrderEventDate('order-id', '2027-03-20'),
		).resolves.toMatchObject({
			eventDate: '2027-03-20',
		});
		mockSetDate.mockResolvedValueOnce(null);
		await expect(updateCommercialOrderEventDate('missing', null)).rejects.toMatchObject({
			status: 404,
		});
	});
});
