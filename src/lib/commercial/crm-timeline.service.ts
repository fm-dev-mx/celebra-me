import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export interface CrmTimelineEntry {
	id: string;
	eventType: CrmTimelineEventType;
	label: string;
	description: string;
	occurredAt: string;
	metadata?: Record<string, unknown>;
}

export type CrmTimelineEventType =
	| 'lead_created'
	| 'order_created'
	| 'deposit_paid'
	| 'capi_event_created'
	| 'capi_event_sent'
	| 'capi_event_failed'
	| 'order_status_changed'
	| 'customer_created';

const TIMELINE_EVENT_LABELS: Record<CrmTimelineEventType, string> = {
	lead_created: 'Lead creado',
	order_created: 'Orden creada',
	deposit_paid: 'Anticipo pagado',
	capi_event_created: 'Evento CAPI creado',
	capi_event_sent: 'Evento CAPI enviado',
	capi_event_failed: 'Evento CAPI fallido',
	order_status_changed: 'Estado de orden cambiado',
	customer_created: 'Cliente creado',
};

export function labelCrmTimelineEventType(type: CrmTimelineEventType): string {
	return TIMELINE_EVENT_LABELS[type] ?? type;
}

interface SalesOrderRow {
	id: string;
	order_number: string;
	event_type: string | null;
	status: string;
	total_amount: number | string;
	deposit_amount: number | string | null;
	amount_paid: number | string;
	created_at: string;
	deposit_paid_at: string | null;
}

interface MetaConversionRow {
	id: string;
	event_id: string;
	event_name: string;
	status: string;
	value: number | string;
	currency: string;
	created_at: string;
	last_error_message: string | null;
}

/**
 * Load a derived CRM timeline for a single customer by combining
 * leads, sales_orders, and meta_conversion_events into a single
 * chronological list.
 */
export async function loadCrmTimeline(
	customerId: string,
	options: { limit?: number } = {},
): Promise<CrmTimelineEntry[]> {
	const limit = options.limit ?? 50;
	const entries: CrmTimelineEntry[] = [];

	// 1. Sales orders for this customer
	const orders = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?customer_id=eq.${encodeURIComponent(customerId)}&select=id,order_number,event_type,status,total_amount,deposit_amount,amount_paid,created_at,deposit_paid_at&order=created_at.desc`,
		method: 'GET',
		useServiceRole: true,
	});

	for (const order of orders) {
		// Order created
		entries.push({
			id: `order-created:${order.id}`,
			eventType: 'order_created',
			label: 'Orden creada',
			description: `Orden ${order.order_number} — ${order.event_type || 'Sin evento'} — $${Number(order.total_amount).toLocaleString('es-MX')}`,
			occurredAt: order.created_at,
			metadata: {
				orderId: order.id,
				orderNumber: order.order_number,
				totalAmount: order.total_amount,
			},
		});

		// Deposit paid
		if (order.deposit_paid_at) {
			entries.push({
				id: `deposit-paid:${order.id}`,
				eventType: 'deposit_paid',
				label: 'Anticipo pagado',
				description: `Anticipo de $${Number(order.amount_paid).toLocaleString('es-MX')} para orden ${order.order_number}`,
				occurredAt: order.deposit_paid_at,
				metadata: {
					orderId: order.id,
					amountPaid: order.amount_paid,
				},
			});
		}
	}

	// 2. CAPI conversion events linked to this customer's orders
	const orderIds = orders.map((o) => o.id);
	if (orderIds.length > 0) {
		const conversions = await supabaseRestRequest<MetaConversionRow[]>({
			pathWithQuery: `meta_conversion_events?order_id=in.(${orderIds.map((id) => encodeURIComponent(id)).join(',')})&select=id,event_id,event_name,status,value,currency,created_at,last_error_message&order=created_at.desc`,
			method: 'GET',
			useServiceRole: true,
		});

		for (const conv of conversions) {
			entries.push({
				id: `capi-created:${conv.id}`,
				eventType: 'capi_event_created',
				label: 'Evento CAPI creado',
				description: `${conv.event_name} — $${Number(conv.value).toLocaleString('es-MX')} ${conv.currency} — ${conv.status}`,
				occurredAt: conv.created_at,
				metadata: { eventId: conv.event_id, status: conv.status },
			});

			if (conv.status === 'sent') {
				entries.push({
					id: `capi-sent:${conv.id}`,
					eventType: 'capi_event_sent',
					label: 'Evento CAPI enviado',
					description: `Enviado a Meta: ${conv.event_name} — $${Number(conv.value).toLocaleString('es-MX')}`,
					occurredAt: conv.created_at,
					metadata: { eventId: conv.event_id },
				});
			}

			if (conv.status === 'failed' && conv.last_error_message) {
				entries.push({
					id: `capi-failed:${conv.id}`,
					eventType: 'capi_event_failed',
					label: 'Evento CAPI fallido',
					description: `Error: ${conv.last_error_message}`,
					occurredAt: conv.created_at,
					metadata: { eventId: conv.event_id, error: conv.last_error_message },
				});
			}
		}
	}

	// Sort by occurred_at descending (newest first)
	entries.sort(
		(a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
	);

	return entries.slice(0, limit);
}
