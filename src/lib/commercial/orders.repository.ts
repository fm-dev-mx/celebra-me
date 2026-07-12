import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export type SalesOrderStatus =
	| 'draft'
	| 'quoted'
	| 'confirmed'
	| 'deposit_paid'
	| 'paid'
	| 'cancelled'
	| 'lost';

export type MetaConversionStatus =
	| 'pending'
	| 'sending'
	| 'sent'
	| 'failed'
	| 'skipped'
	| 'ambiguous';
type MetaConversionEventName = 'Purchase';

export interface SalesOrderInput {
	idempotencyKey: string;
	orderNumber: string;
	customerId: string;
	leadId?: string;
	sessionId?: string;
	sourceEventId?: string;
	status: SalesOrderStatus;
	eventType: string;
	packageId?: string;
	packageName?: string;
	currency: string;
	totalAmount: number;
	depositAmount?: number;
	createdBy?: string;
}

export interface SalesOrder {
	id: string;
	orderNumber: string;
	customerId: string;
	leadId?: string | null;
	sessionId?: string | null;
	sourceEventId?: string | null;
	status: SalesOrderStatus;
	eventType?: string | null;
	packageId?: string | null;
	packageName?: string | null;
	currency: string;
	totalAmount: number;
	depositAmount?: number | null;
	amountPaid: number;
	depositPaidAt?: string | null;
	paidAt?: string | null;
	idempotencyKey?: string | null;
	depositIdempotencyKey?: string | null;
	wasCreated?: boolean;
}

export interface MetaConversionEvent {
	id: string;
	orderId?: string;
	eventId: string;
	eventName: MetaConversionEventName;
	status: MetaConversionStatus;
	value: number;
	currency: string;
}

interface SalesOrderRow {
	id: string;
	order_number: string;
	customer_id: string;
	lead_id?: string | null;
	session_id?: string | null;
	source_event_id?: string | null;
	status: SalesOrderStatus;
	event_type?: string | null;
	package_id?: string | null;
	package_name?: string | null;
	currency: string;
	total_amount: number | string;
	deposit_amount?: number | string | null;
	amount_paid: number | string;
	deposit_paid_at?: string | null;
	paid_at?: string | null;
	idempotency_key?: string | null;
	deposit_idempotency_key?: string | null;
}

interface MetaConversionEventRow {
	id: string;
	order_id?: string;
	event_id: string;
	event_name: MetaConversionEventName;
	status: MetaConversionStatus;
	value: number | string;
	currency: string;
}

const ORDER_SELECT =
	'id,order_number,customer_id,lead_id,session_id,source_event_id,status,event_type,package_id,package_name,currency,total_amount,deposit_amount,amount_paid,deposit_paid_at,paid_at,idempotency_key,deposit_idempotency_key';

function emptyToUndefined(value: string | undefined | null): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function toNumber(value: number | string | null | undefined): number {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') return Number(value);
	return 0;
}

function toSalesOrder(row: SalesOrderRow): SalesOrder {
	return {
		id: row.id,
		orderNumber: row.order_number,
		customerId: row.customer_id,
		leadId: row.lead_id,
		sessionId: row.session_id,
		sourceEventId: row.source_event_id,
		status: row.status,
		eventType: row.event_type,
		packageId: row.package_id,
		packageName: row.package_name,
		currency: row.currency,
		totalAmount: toNumber(row.total_amount),
		depositAmount: row.deposit_amount == null ? null : toNumber(row.deposit_amount),
		amountPaid: toNumber(row.amount_paid),
		depositPaidAt: row.deposit_paid_at,
		paidAt: row.paid_at,
		idempotencyKey: row.idempotency_key,
		depositIdempotencyKey: row.deposit_idempotency_key,
	};
}

function toMetaConversionEvent(row: MetaConversionEventRow): MetaConversionEvent {
	return {
		id: row.id,
		orderId: row.order_id,
		eventId: row.event_id,
		eventName: row.event_name,
		status: row.status,
		value: toNumber(row.value),
		currency: row.currency,
	};
}

export async function createSalesOrder(input: SalesOrderInput): Promise<SalesOrder> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?on_conflict=idempotency_key&select=${ORDER_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			idempotency_key: input.idempotencyKey,
			order_number: input.orderNumber,
			customer_id: input.customerId,
			lead_id: emptyToUndefined(input.leadId),
			session_id: emptyToUndefined(input.sessionId),
			source_event_id: emptyToUndefined(input.sourceEventId),
			status: input.status,
			event_type: input.eventType,
			package_id: emptyToUndefined(input.packageId),
			package_name: emptyToUndefined(input.packageName),
			currency: input.currency,
			total_amount: input.totalAmount,
			deposit_amount: input.depositAmount,
			created_by: emptyToUndefined(input.createdBy),
			confirmed_at: input.status === 'confirmed' ? new Date().toISOString() : undefined,
		},
	});
	const wasCreated = Boolean(rows[0]);
	let row = rows[0];
	if (!row) {
		const existing = await supabaseRestRequest<SalesOrderRow[]>({
			pathWithQuery: `sales_orders?idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&select=${ORDER_SELECT}&limit=1`,
			method: 'GET',
			useServiceRole: true,
		});
		row = existing[0];
	}
	if (!row) throw new Error('Sales order insert did not return an order id.');
	if (
		row.customer_id !== input.customerId ||
		(row.lead_id ?? null) !== (emptyToUndefined(input.leadId) ?? null) ||
		row.status !== input.status ||
		row.event_type !== input.eventType ||
		toNumber(row.total_amount) !== input.totalAmount ||
		(row.deposit_amount == null ? null : toNumber(row.deposit_amount)) !==
			(input.depositAmount ?? null) ||
		(row.package_name ?? null) !== (emptyToUndefined(input.packageName) ?? null)
	) {
		throw new Error('ORDER_IDEMPOTENCY_CONFLICT');
	}
	return { ...toSalesOrder(row), wasCreated };
}

export async function findSalesOrdersByCustomerId(customerId: string): Promise<SalesOrder[]> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?customer_id=eq.${encodeURIComponent(customerId)}&select=${ORDER_SELECT}&order=created_at.desc`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toSalesOrder);
}

export async function registerSalesOrderDepositPurchase(input: {
	orderId: string;
	amountPaid: number;
	paidAt: string;
	actorId: string;
	idempotencyKey: string;
}): Promise<{ order: SalesOrder; conversionEvent: MetaConversionEvent; idempotent: boolean }> {
	interface DepositRpcRow {
		order: SalesOrderRow;
		conversion_event: MetaConversionEventRow;
		idempotent: boolean;
	}
	const result = await supabaseRestRequest<DepositRpcRow>({
		pathWithQuery: 'rpc/register_commercial_deposit_purchase',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_order_id: input.orderId,
			p_amount_paid: input.amountPaid,
			p_actor_id: input.actorId,
			p_paid_at: input.paidAt,
			p_idempotency_key: input.idempotencyKey,
		},
	});
	if (!result?.order || !result.conversion_event) {
		throw new Error('Deposit Purchase transaction did not return its authoritative result.');
	}
	return {
		order: toSalesOrder(result.order),
		conversionEvent: toMetaConversionEvent(result.conversion_event),
		idempotent: result.idempotent,
	};
}

