jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	supabaseRestRequest: jest.fn(),
}));

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadCommercialDashboardData } from '@/lib/tracking/commercial-dashboard.server';

const mockRest = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

describe('commercial historical Purchase diagnostics', () => {
	it('lists historical paid orders without a stable Purchase without issuing repair writes', async () => {
		mockRest
			.mockResolvedValueOnce([]) // sessions
			.mockResolvedValueOnce([]) // events
			.mockResolvedValueOnce([]) // leads
			.mockResolvedValueOnce([
				{
					id: 'order-legacy',
					order_number: 'CMO-LEGACY',
					customer_id: 'customer-1',
					lead_id: 'lead-1',
					status: 'deposit_paid',
					total_amount: 1000,
					amount_paid: 500,
					deposit_paid_at: '2026-07-01T00:00:00.000Z',
				},
			])
			.mockResolvedValueOnce([]) // conversions
			.mockResolvedValueOnce([]); // classifications

		const summary = await loadCommercialDashboardData();

		expect(summary.historicalPaidOrdersWithoutPurchase).toEqual([
			expect.objectContaining({
				orderId: 'order-legacy',
				orderNumber: 'CMO-LEGACY',
				customerId: 'customer-1',
				leadId: 'lead-1',
				status: 'deposit_paid',
			}),
		]);
		expect(
			mockRest.mock.calls.every(([options]) => !options.method || options.method === 'GET'),
		).toBe(true);
	});

	it('does not report an order that already has its stable Purchase event', async () => {
		mockRest
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					id: 'order-complete',
					status: 'paid',
					total_amount: 1000,
					amount_paid: 1000,
				},
			])
			.mockResolvedValueOnce([
				{
					id: 'conversion-1',
					order_id: 'order-complete',
					event_id: 'purchase:order-complete:deposit_paid',
					status: 'sent',
				},
			])
			.mockResolvedValueOnce([]);

		const summary = await loadCommercialDashboardData();

		expect(summary.historicalPaidOrdersWithoutPurchase).toEqual([]);
	});
});
