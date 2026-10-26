/** @jest-environment node */
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { listCommercialSalesOrders } from '@/lib/commercial/orders.repository';
import { getOrderPaymentStatus } from '@/lib/commercial/order-payment-status';

test.each([
	['quoted', 0, 'quoted'],
	['deposit_paid', 250, 'partial'],
	['deposit_paid', 1000, 'paid'],
	['lost', 250, 'lost'],
	['cancelled', 1000, 'lost'],
] as const)('classifies %s with %s paid as %s', (status, amountPaid, expected) => {
	expect(getOrderPaymentStatus({ status, amountPaid, totalAmount: 1000 })).toBe(expected);
});
test('filters full transfers despite the stored first-payment status', async () => {
	jest.mocked(supabaseRestRequest).mockResolvedValue([
		{ id: 'full', status: 'deposit_paid', total_amount: '1000', amount_paid: '1000' },
		{ id: 'partial', status: 'deposit_paid', total_amount: '1000', amount_paid: '250' },
	]);
	expect((await listCommercialSalesOrders(0, 'paid')).items.map((item) => item.id)).toEqual([
		'full',
	]);
	expect((await listCommercialSalesOrders(0, 'partial')).items.map((item) => item.id)).toEqual([
		'partial',
	]);
});
test('advances the scan cursor even when the current page contains no matches', async () => {
	jest.mocked(supabaseRestRequest).mockResolvedValue(
		Array.from({ length: 50 }, (_, id) => ({
			id: String(id),
			status: 'deposit_paid',
			total_amount: 1000,
			amount_paid: 1000,
		})),
	);
	expect(await listCommercialSalesOrders(50, 'partial')).toEqual({ items: [], nextOffset: 100 });
});
