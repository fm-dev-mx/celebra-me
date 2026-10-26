import type { InvitationDataAnswers, InvitationDataStatus } from '@/lib/invitation-data/form';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export interface InvitationDataOrder {
	id: string;
	orderNumber: string;
	status: string;
	eventType: string | null;
	customerId: string;
	leadId: string | null;
	customerName: string | null;
	customerPhoneE164: string | null;
	lead: {
		eventType: string | null;
		eventDate: string | null;
		celebrantNames: string | null;
	} | null;
}

export interface InvitationDataRequest {
	id: string;
	orderId: string;
	tokenIssuedAt: string;
	expiresAt: string;
	answers: InvitationDataAnswers;
	status: InvitationDataStatus;
	lastSavedAt: string | null;
	submittedAt: string | null;
	ownerReviewedAt: string | null;
}

interface OrderRow {
	id: string;
	order_number: string;
	status: string;
	event_type: string | null;
	customer_id: string;
	lead_id: string | null;
	customers: { display_name: string | null; phone_e164: string | null } | null;
	leads: {
		event_type: string | null;
		event_date: string | null;
		celebrant_names: string | null;
	} | null;
}

interface RequestRow {
	id: string;
	order_id: string;
	token_issued_at: string;
	expires_at: string;
	answers: InvitationDataAnswers | null;
	status: InvitationDataStatus;
	last_saved_at: string | null;
	submitted_at: string | null;
	owner_reviewed_at: string | null;
}

interface RequestWithOrderRow extends RequestRow {
	sales_orders: OrderRow | null;
}

const ORDER_SELECT =
	'id,order_number,status,event_type,customer_id,lead_id,customers(display_name,phone_e164),leads(event_type,event_date,celebrant_names)';
const REQUEST_SELECT =
	'id,order_id,token_issued_at,expires_at,answers,status,last_saved_at,submitted_at,owner_reviewed_at';

function toOrder(row: OrderRow): InvitationDataOrder {
	return {
		id: row.id,
		orderNumber: row.order_number,
		status: row.status,
		eventType: row.event_type,
		customerId: row.customer_id,
		leadId: row.lead_id,
		customerName: row.customers?.display_name ?? null,
		customerPhoneE164: row.customers?.phone_e164 ?? null,
		lead: row.leads
			? {
					eventType: row.leads.event_type,
					eventDate: row.leads.event_date,
					celebrantNames: row.leads.celebrant_names,
				}
			: null,
	};
}

function toRequest(row: RequestRow): InvitationDataRequest {
	return {
		id: row.id,
		orderId: row.order_id,
		tokenIssuedAt: row.token_issued_at,
		expiresAt: row.expires_at,
		answers: row.answers ?? {},
		status: row.status,
		lastSavedAt: row.last_saved_at,
		submittedAt: row.submitted_at,
		ownerReviewedAt: row.owner_reviewed_at,
	};
}

export async function findInvitationDataOrder(
	orderId: string,
): Promise<InvitationDataOrder | null> {
	const rows = await supabaseRestRequest<OrderRow[]>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=${ORDER_SELECT}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toOrder(rows[0]) : null;
}

/**
 * Creates the order's request or replaces its token. Answers and review state stay, so a new link
 * keeps what the client already wrote.
 */
export async function upsertInvitationDataToken(input: {
	orderId: string;
	tokenHash: string;
	issuedAt: string;
	expiresAt: string;
	createdBy?: string;
}): Promise<InvitationDataRequest> {
	const rows = await supabaseRestRequest<RequestRow[]>({
		pathWithQuery: `invitation_data_requests?on_conflict=order_id&select=${REQUEST_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			order_id: input.orderId,
			token_hash: input.tokenHash,
			token_issued_at: input.issuedAt,
			expires_at: input.expiresAt,
			...(input.createdBy ? { created_by: input.createdBy } : {}),
		},
	});
	if (!rows[0]) throw new Error('Invitation data link upsert returned no row.');
	return toRequest(rows[0]);
}

export async function findInvitationDataRequestByOrderId(
	orderId: string,
): Promise<InvitationDataRequest | null> {
	const rows = await supabaseRestRequest<RequestRow[]>({
		pathWithQuery: `invitation_data_requests?order_id=eq.${encodeURIComponent(orderId)}&select=${REQUEST_SELECT}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRequest(rows[0]) : null;
}

export async function findInvitationDataRequestByTokenHash(
	tokenHash: string,
): Promise<{ request: InvitationDataRequest; order: InvitationDataOrder } | null> {
	const rows = await supabaseRestRequest<RequestWithOrderRow[]>({
		pathWithQuery: `invitation_data_requests?token_hash=eq.${encodeURIComponent(tokenHash)}&select=${REQUEST_SELECT},sales_orders(${ORDER_SELECT})&limit=1`,
		useServiceRole: true,
	});
	const row = rows[0];
	if (!row?.sales_orders) return null;
	return { request: toRequest(row), order: toOrder(row.sales_orders) };
}

/**
 * Saves answers only while the token is still the current one. `firstSubmission` also moves the
 * request to submitted, and matches nothing once it already is, so exactly one caller wins it.
 */
export async function saveInvitationDataAnswers(input: {
	requestId: string;
	tokenHash: string;
	answers: InvitationDataAnswers;
	status: InvitationDataStatus;
	savedAt: string;
	/** Sets `submitted_at`; only valid together with `onlyIfUnsubmitted`. */
	firstSubmission?: boolean;
	/** Updates nothing once the form was submitted, so a stale status never overwrites it. */
	onlyIfUnsubmitted?: boolean;
}): Promise<InvitationDataRequest | null> {
	const filters = [
		`id=eq.${encodeURIComponent(input.requestId)}`,
		`token_hash=eq.${encodeURIComponent(input.tokenHash)}`,
		...(input.onlyIfUnsubmitted || input.firstSubmission ? ['submitted_at=is.null'] : []),
	];
	const rows = await supabaseRestRequest<RequestRow[]>({
		pathWithQuery: `invitation_data_requests?${filters.join('&')}&select=${REQUEST_SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			answers: input.answers,
			status: input.status,
			last_saved_at: input.savedAt,
			...(input.firstSubmission ? { submitted_at: input.savedAt } : {}),
		},
	});
	return rows[0] ? toRequest(rows[0]) : null;
}

export async function markInvitationDataReviewed(input: {
	orderId: string;
	reviewedAt: string;
}): Promise<InvitationDataRequest | null> {
	const rows = await supabaseRestRequest<RequestRow[]>({
		pathWithQuery: `invitation_data_requests?order_id=eq.${encodeURIComponent(input.orderId)}&select=${REQUEST_SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { owner_reviewed_at: input.reviewedAt },
	});
	return rows[0] ? toRequest(rows[0]) : null;
}

export interface InvitationDataInboxEntry {
	request: InvitationDataRequest;
	order: InvitationDataOrder;
}

/** Submitted forms, newest save first; the service keeps the ones not reviewed since. */
export async function listSubmittedInvitationData(limit = 50): Promise<InvitationDataInboxEntry[]> {
	const rows = await supabaseRestRequest<RequestWithOrderRow[]>({
		pathWithQuery: `invitation_data_requests?status=eq.submitted&select=${REQUEST_SELECT},sales_orders(${ORDER_SELECT})&order=last_saved_at.desc&limit=${limit}`,
		useServiceRole: true,
	});
	return rows.flatMap((row) =>
		row.sales_orders ? [{ request: toRequest(row), order: toOrder(row.sales_orders) }] : [],
	);
}

/** One CompleteRegistration per order: the event_id is derived from the order. */
export async function enqueueCompleteRegistration(input: {
	orderId: string;
	customerId: string;
	leadId: string | null;
}): Promise<string | null> {
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery: 'meta_conversion_events?on_conflict=event_id&select=id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			order_id: input.orderId,
			customer_id: input.customerId,
			lead_id: input.leadId,
			event_name: 'CompleteRegistration',
			event_id: `complete_registration:${input.orderId}`,
			trigger_status: 'invitation_data_submitted',
			value: null,
			currency: 'MXN',
			status: 'pending',
		},
	});
	return rows[0]?.id ?? null;
}
