import type { SalesOrder } from './orders.repository';

/** The first-payment RPC retains deposit_paid even when the transfer covers the total. */
export function getOrderPaymentStatus(
	order: Pick<SalesOrder, 'status' | 'amountPaid' | 'totalAmount'>,
): 'quoted' | 'partial' | 'paid' | 'lost' {
	if (order.status === 'lost' || order.status === 'cancelled') return 'lost';
	if (order.amountPaid > 0) return order.amountPaid >= order.totalAmount ? 'paid' : 'partial';
	return 'quoted';
}
