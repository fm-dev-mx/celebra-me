import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { getOrderPaymentStatus } from './order-payment-status';

export type SalesOrderStatus =
	'draft' | 'quoted' | 'confirmed' | 'deposit_paid' | 'paid' | 'cancelled' | 'lost';

type MetaConversionStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'ambiguous';
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
	isPastSale?: boolean;
	soldAt?: string;
	referredByCustomerId?: string;
	referralCodeUsed?: string;
	discountAmount?: number;
	referrerCreditRedeemed?: number;
	eventDate?: string;
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
	isPastSale: boolean;
	soldAt?: string | null;
	referredByCustomerId?: string | null;
	referralCodeUsed?: string | null;
	discountAmount: number;
	referrerCreditAwarded: number;
	referrerCreditRedeemed: number;
	eventDate?: string | null;
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
	is_past_sale?: boolean | null;
	sold_at?: string | null;
	referred_by_customer_id?: string | null;
	referral_code_used?: string | null;
	discount_amount?: number | string | null;
	referrer_credit_awarded?: number | string | null;
	referrer_credit_redeemed?: number | string | null;
	event_date?: string | null;
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
	'id,order_number,customer_id,lead_id,session_id,source_event_id,status,event_type,package_id,package_name,currency,total_amount,deposit_amount,amount_paid,deposit_paid_at,paid_at,idempotency_key,deposit_idempotency_key,is_past_sale,sold_at,referred_by_customer_id,referral_code_used,discount_amount,referrer_credit_awarded,referrer_credit_redeemed,event_date';

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
		isPastSale: row.is_past_sale === true,
		soldAt: row.sold_at,
		referredByCustomerId: row.referred_by_customer_id,
		referralCodeUsed: row.referral_code_used,
		discountAmount: toNumber(row.discount_amount),
		referrerCreditAwarded: toNumber(row.referrer_credit_awarded),
		referrerCreditRedeemed: toNumber(row.referrer_credit_redeemed),
		eventDate: row.event_date ?? null,
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

export async function findSalesOrderByIdempotencyKey(
	idempotencyKey: string,
): Promise<SalesOrder | null> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=${ORDER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toSalesOrder(rows[0]) : null;
}

/** Atomically spends a customer's referral credit; false when the balance no longer covers it. */
export async function redeemCustomerReferralCredit(
	customerId: string,
	amount: number,
): Promise<boolean> {
	const result = await supabaseRestRequest<boolean>({
		pathWithQuery: 'rpc/redeem_customer_referral_credit',
		method: 'POST',
		useServiceRole: true,
		body: { p_customer_id: customerId, p_amount: amount },
	});
	return result === true;
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
			is_past_sale: input.isPastSale === true,
			sold_at: emptyToUndefined(input.soldAt),
			referred_by_customer_id: emptyToUndefined(input.referredByCustomerId),
			referral_code_used: emptyToUndefined(input.referralCodeUsed),
			discount_amount: input.discountAmount ?? 0,
			referrer_credit_redeemed: input.referrerCreditRedeemed ?? 0,
			event_date: emptyToUndefined(input.eventDate),
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

export async function listCommercialSalesOrders(
	offset: number,
	status?: string,
): Promise<{ items: SalesOrder[]; nextOffset: number | null }> {
	const statuses: Record<string, string> = {
		quoted: 'draft,quoted,confirmed',
		partial: 'deposit_paid,paid',
		paid: 'deposit_paid,paid',
		lost: 'lost,cancelled',
	};
	const filter = status && statuses[status] ? `&status=in.(${statuses[status]})` : '';
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?select=${ORDER_SELECT}&order=created_at.desc,id.desc&limit=50&offset=${offset}${filter}`,
		method: 'GET',
		useServiceRole: true,
	});
	return {
		items: rows
			.map(toSalesOrder)
			.filter((order) => !status || getOrderPaymentStatus(order) === status),
		nextOffset: rows.length === 50 ? offset + rows.length : null,
	};
}

export async function registerSalesOrderDepositPurchase(input: {
	orderId: string;
	amountPaid: number;
	paidAt: string;
	actorId: string;
	idempotencyKey: string;
}): Promise<{
	order: SalesOrder;
	conversionEvent: MetaConversionEvent | null;
	idempotent: boolean;
}> {
	interface DepositRpcRow {
		order: SalesOrderRow;
		conversion_event: MetaConversionEventRow | null;
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
	if (!result?.order) {
		throw new Error('Deposit Purchase transaction did not return its authoritative result.');
	}
	return {
		order: toSalesOrder(result.order),
		conversionEvent: result.conversion_event
			? toMetaConversionEvent(result.conversion_event)
			: null,
		idempotent: result.idempotent,
	};
}

export type SalesOrderPaymentKind = 'deposit' | 'installment' | 'settlement';

export interface SalesOrderPayment {
	id: string;
	orderId: string;
	kind: SalesOrderPaymentKind;
	amount: number;
	paidAt: string;
}

interface SalesOrderPaymentRow {
	id: string;
	order_id: string;
	kind: SalesOrderPaymentKind;
	amount: number | string;
	paid_at: string;
}

function toSalesOrderPayment(row: SalesOrderPaymentRow): SalesOrderPayment {
	return {
		id: row.id,
		orderId: row.order_id,
		kind: row.kind,
		amount: toNumber(row.amount),
		paidAt: row.paid_at,
	};
}

export async function findSalesOrderById(orderId: string): Promise<SalesOrder | null> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=${ORDER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toSalesOrder(rows[0]) : null;
}

export async function listSalesOrderPayments(orderId: string): Promise<SalesOrderPayment[]> {
	const rows = await supabaseRestRequest<SalesOrderPaymentRow[]>({
		pathWithQuery: `sales_order_payments?order_id=eq.${encodeURIComponent(orderId)}&select=id,order_id,kind,amount,paid_at&order=paid_at.asc,created_at.asc`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toSalesOrderPayment);
}

/** Sets or clears the event date of an order; null when the order does not exist. */
export async function setSalesOrderEventDate(
	orderId: string,
	eventDate: string | null,
): Promise<SalesOrder | null> {
	const rows = await supabaseRestRequest<SalesOrderRow[]>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=${ORDER_SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { event_date: eventDate },
	});
	return rows[0] ? toSalesOrder(rows[0]) : null;
}

/** The invitation production signals the order line derives its late stages from. */
export async function findOrderProductionSources(orderId: string): Promise<{
	dataRequestStatus: string | null;
	invitationStatus: string | null;
}> {
	const [requests, orders] = await Promise.all([
		supabaseRestRequest<Array<{ status: string }>>({
			pathWithQuery: `invitation_data_requests?order_id=eq.${encodeURIComponent(orderId)}&select=status&limit=1`,
			method: 'GET',
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ invitations: { status: string } | null }>>({
			pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=invitations(status)&limit=1`,
			method: 'GET',
			useServiceRole: true,
		}),
	]);
	return {
		dataRequestStatus: requests[0]?.status ?? null,
		invitationStatus: orders[0]?.invitations?.status ?? null,
	};
}

export async function registerSalesOrderPayment(input: {
	orderId: string;
	amount: number;
	paidAt: string;
	actorId: string;
	idempotencyKey: string;
}): Promise<{ order: SalesOrder; payment: SalesOrderPayment; idempotent: boolean }> {
	const result = await supabaseRestRequest<{
		order: SalesOrderRow;
		payment: SalesOrderPaymentRow;
		idempotent: boolean;
	}>({
		pathWithQuery: 'rpc/register_commercial_order_payment',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_order_id: input.orderId,
			p_amount: input.amount,
			p_actor_id: input.actorId,
			p_paid_at: input.paidAt,
			p_idempotency_key: input.idempotencyKey,
		},
	});
	if (!result?.order || !result.payment) {
		throw new Error('Order payment transaction did not return its authoritative result.');
	}
	return {
		order: toSalesOrder(result.order),
		payment: toSalesOrderPayment(result.payment),
		idempotent: result.idempotent,
	};
}
