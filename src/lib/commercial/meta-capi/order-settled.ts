import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

// Sent once per order when it is fully paid (the deposit covers the total, or the last payment
// settles the balance). The Purchase already carried the total at the deposit, so this custom
// event closes the cycle in Meta without a value and never double-counts revenue.
export const ORDER_SETTLED_EVENT_NAME = 'OrderSettled';
export const ORDER_SETTLED_TRIGGER_STATUS = 'order_settled';
export const createOrderSettledEventId = (orderId: string): string => `order-settled:${orderId}`;

/** Queues the one OrderSettled event of a fully paid order; a repeated call keeps the first row. */
export async function enqueueOrderSettledEvent(input: {
	orderId: string;
	customerId: string;
	leadId: string | null;
}): Promise<string | null> {
	const rows = await supabaseRestRequest<Array<{ id: string }> | null>({
		pathWithQuery: 'meta_conversion_events?on_conflict=event_id&select=id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			order_id: input.orderId,
			customer_id: input.customerId,
			lead_id: input.leadId,
			event_name: ORDER_SETTLED_EVENT_NAME,
			event_id: createOrderSettledEventId(input.orderId),
			trigger_status: ORDER_SETTLED_TRIGGER_STATUS,
			value: null,
			currency: 'MXN',
			status: 'pending',
		},
	});
	return Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
}
