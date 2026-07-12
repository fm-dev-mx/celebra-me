import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { createSalesOrder } from '@/lib/commercial/orders.repository';

const mockRequest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

const baseInput = {
	idempotencyKey: '11111111-1111-4111-8111-111111111111',
	orderNumber: 'CMO-20260711-ABC123',
	customerId: 'customer-id',
	status: 'confirmed' as const,
	eventType: 'xv',
	currency: 'MXN',
	totalAmount: 1800,
};

const baseRow = {
	id: 'order-id-1',
	order_number: 'CMO-20260711-ABC123',
	customer_id: 'customer-id',
	status: 'confirmed' as const,
	event_type: 'xv',
	currency: 'MXN',
	total_amount: 1800,
	amount_paid: 0,
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('createSalesOrder idempotency', () => {
	it('sends on_conflict=idempotency_key for PostgREST ON CONFLICT inference', async () => {
		mockRequest.mockResolvedValueOnce([baseRow] as never);

		await createSalesOrder(baseInput);

		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				pathWithQuery: expect.stringContaining('on_conflict=idempotency_key'),
				method: 'POST',
				prefer: expect.stringContaining('resolution=ignore-duplicates'),
			}),
		);
	});

	it('returns the newly created order on first insert', async () => {
		mockRequest.mockResolvedValueOnce([baseRow] as never);

		const result = await createSalesOrder(baseInput);

		expect(result.id).toBe('order-id-1');
		expect(result.wasCreated).toBe(true);
	});

	it('returns the existing order on idempotent retry (ignore-duplicates)', async () => {
		// First call: INSERT returns empty (204 — duplicate suppressed)
		mockRequest.mockResolvedValueOnce([]);
		// Second call: SELECT returns the existing row
		mockRequest.mockResolvedValueOnce([baseRow] as never);

		const result = await createSalesOrder(baseInput);

		expect(result.id).toBe('order-id-1');
		expect(result.wasCreated).toBe(false);
	});

	it('throws ORDER_IDEMPOTENCY_CONFLICT when retry payload differs', async () => {
		// First call: INSERT returns empty (duplicate suppressed)
		mockRequest.mockResolvedValueOnce([]);
		// Second call: SELECT returns existing row with different data
		mockRequest.mockResolvedValueOnce([
			{ ...baseRow, total_amount: 999, status: 'deposit_paid' },
		] as never);

		await expect(createSalesOrder(baseInput)).rejects.toThrow(
			'ORDER_IDEMPOTENCY_CONFLICT',
		);
	});

	it('does not create a duplicate order on retry', async () => {
		// First call: INSERT returns empty
		mockRequest.mockResolvedValueOnce([]);
		// Second call: SELECT returns existing row (matching data)
		mockRequest.mockResolvedValueOnce([baseRow] as never);

		const result = await createSalesOrder(baseInput);

		// Only two fetch calls: one POST, one GET fallback
		expect(mockRequest).toHaveBeenCalledTimes(2);
		expect(result.id).toBe('order-id-1');
	});
});
