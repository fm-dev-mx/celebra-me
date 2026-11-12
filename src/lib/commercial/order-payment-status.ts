import type { SalesOrder } from './orders.repository';

/** Order stages shown in Pedidos, in funnel order; they mirror the stored order status. */
export const ORDER_STAGE_LABELS = {
	draft: 'Borrador',
	quoted: 'Cotizado',
	confirmed: 'Confirmado',
	deposit_paid: 'Anticipo',
	paid: 'Liquidado',
	cancelled: 'Cancelado',
	lost: 'Perdido',
} as const;
export const ORDER_STAGE_VALUES = Object.keys(ORDER_STAGE_LABELS);

/** The first-payment RPC retains deposit_paid even when the transfer covers the total. */
export function getOrderPaymentStatus(
	order: Pick<SalesOrder, 'status' | 'amountPaid' | 'totalAmount'>,
): 'quoted' | 'partial' | 'paid' | 'lost' {
	if (order.status === 'lost' || order.status === 'cancelled') return 'lost';
	if (order.amountPaid > 0) return order.amountPaid >= order.totalAmount ? 'paid' : 'partial';
	return 'quoted';
}
