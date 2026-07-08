import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export type SalesOrderStatus =
	| 'draft'
	| 'quoted'
	| 'confirmed'
	| 'deposit_paid'
	| 'paid'
	| 'cancelled'
	| 'lost';

export type MetaConversionStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
export type MetaConversionEventName = 'Purchase';
export type MetaConversionTriggerStatus = 'deposit_paid';

export interface SalesOrderInput {
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
}

export interface MetaConversionEventInput {
	orderId: string;
	leadId?: string | null;
	customerId: string;
	eventName: MetaConversionEventName;
	eventId: string;
	triggerStatus: MetaConversionTriggerStatus;
	value: number;
	currency: string;
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
	'id,order_number,customer_id,lead_id,session_id,source_event_id,status,event_type,package_id,package_name,currency,total_amount,deposit_amount,amount_paid,deposit_paid_at,paid_at';

const CONVERSION_SELECT = 'id,order_id,event_id,event_name,status,value,currency';

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
		pathWithQuery: `sales_orders?select=${ORDER_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
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
	const row = rows[0];
	if (!row) throw new Error('Sales order insert did not return an order id.');
	return toSalesOrder(row);
}

export async function findSalesOrderById(orderId: string): Promise<SalesOrder | null> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=${ORDER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toSalesOrder(rows[0]) : null;
}

export async function updateSalesOrderDepositPaid(input: {
	orderId: string;
	amountPaid: number;
	paidAt: string;
}): Promise<SalesOrder> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(input.orderId)}&select=${ORDER_SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			status: 'deposit_paid',
			amount_paid: input.amountPaid,
			deposit_paid_at: input.paidAt,
		},
	});
	const row = rows[0];
	if (!row) throw new Error('Sales order deposit update did not return an order id.');
	return toSalesOrder(row);
}

export async function findMetaConversionEventByEventId(
	eventId: string,
): Promise<MetaConversionEvent | null> {
	const rows = await supabaseRestRequest<MetaConversionEventRow[]>({
		pathWithQuery: `meta_conversion_events?event_id=eq.${encodeURIComponent(eventId)}&select=${CONVERSION_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toMetaConversionEvent(rows[0]) : null;
}

export async function upsertMetaConversionEvent(
	input: MetaConversionEventInput,
): Promise<MetaConversionEvent> {
	const rows = await supabaseRestRequest<MetaConversionEventRow[]>({
		pathWithQuery: `meta_conversion_events?on_conflict=event_id&select=${CONVERSION_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			order_id: input.orderId,
			lead_id: emptyToUndefined(input.leadId),
			customer_id: input.customerId,
			event_name: input.eventName,
			event_id: input.eventId,
			trigger_status: input.triggerStatus,
			value: input.value,
			currency: input.currency,
			status: 'pending',
		},
	});
	const row = rows[0];
	if (!row) throw new Error('Meta conversion event upsert did not return an id.');
	return toMetaConversionEvent(row);
}
