import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { normalizeReferralCode } from '@/lib/commercial/referrals';

export interface CommercialLeadCandidate {
	id: string;
	leadCode: string;
	channel: string;
	status: string;
	customerId?: string | null;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	phoneE164?: string | null;
	eventType?: string | null;
	packageInterest?: string | null;
	utmSource?: string | null;
	utmMedium?: string | null;
	utmCampaign?: string | null;
	createdAt?: string | null;
	isPastSale?: boolean;
	referredByCustomerId?: string | null;
	referralCodeUsed?: string | null;
	referrerExternalId?: string | null;
}

export interface CommercialCustomerInput {
	displayName: string;
	email?: string;
	normalizedEmail?: string;
	phoneCountryCode?: string;
	phoneNational?: string;
	phoneE164?: string;
	createdFromLeadId?: string;
	city?: string;
	country?: string;
	isPastClient?: boolean;
	referralCode?: string;
}

export interface CommercialCustomer {
	id: string;
	displayName: string;
	email?: string | null;
	phoneE164?: string | null;
	referralCode: string;
	city?: string | null;
	country: string;
	isPastClient: boolean;
	referralCreditMxn: number;
}

export interface LinkCommercialLeadToCustomerInput {
	leadId: string;
	customerId: string;
}

interface CommercialLeadRow {
	id: string;
	lead_code: string;
	channel: string;
	status: string;
	customer_id?: string | null;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	phone_e164?: string | null;
	event_type?: string | null;
	package_interest?: string | null;
	utm_source?: string | null;
	utm_medium?: string | null;
	utm_campaign?: string | null;
	created_at?: string | null;
	is_past_sale?: boolean | null;
	referred_by_customer_id?: string | null;
	referral_code_used?: string | null;
	referrer_external_id?: string | null;
}

interface CommercialCustomerRow {
	id: string;
	display_name: string;
	email?: string | null;
	phone_e164?: string | null;
	referral_code?: string | null;
	city?: string | null;
	country?: string | null;
	is_past_client?: boolean | null;
	referral_credit_mxn?: number | string | null;
}

const LEAD_SELECT =
	'id,lead_code,channel,status,customer_id,name,email,phone,phone_e164,event_type,package_interest,utm_source,utm_medium,utm_campaign,created_at,is_past_sale,referred_by_customer_id,referral_code_used,referrer_external_id';

export function emptyToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function toLeadCandidate(row: CommercialLeadRow): CommercialLeadCandidate {
	return {
		id: row.id,
		leadCode: row.lead_code,
		channel: row.channel,
		status: row.status,
		customerId: row.customer_id,
		name: row.name,
		email: row.email,
		phone: row.phone,
		phoneE164: row.phone_e164,
		eventType: row.event_type,
		packageInterest: row.package_interest,
		utmSource: row.utm_source,
		utmMedium: row.utm_medium,
		utmCampaign: row.utm_campaign,
		createdAt: row.created_at,
		isPastSale: row.is_past_sale === true,
		referredByCustomerId: row.referred_by_customer_id,
		referralCodeUsed: row.referral_code_used,
		referrerExternalId: row.referrer_external_id,
	};
}

export async function findCommercialLeadByCode(
	leadCode: string,
): Promise<CommercialLeadCandidate | null> {
	const rows = await supabaseRestRequest<CommercialLeadRow[]>({
		pathWithQuery: `leads?lead_code=eq.${encodeURIComponent(leadCode)}&select=${LEAD_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toLeadCandidate(rows[0]) : null;
}

export async function findCommercialLeadsByPhone(
	phoneE164: string,
): Promise<CommercialLeadCandidate[]> {
	const rows = await supabaseRestRequest<CommercialLeadRow[]>({
		pathWithQuery: `leads?phone_e164=eq.${encodeURIComponent(phoneE164)}&select=${LEAD_SELECT}&order=created_at.desc&limit=10`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toLeadCandidate);
}

export async function findCommercialLeadsByEmail(
	email: string,
): Promise<CommercialLeadCandidate[]> {
	const rows = await supabaseRestRequest<CommercialLeadRow[]>({
		pathWithQuery: `leads?email=eq.${encodeURIComponent(email)}&select=${LEAD_SELECT}&order=created_at.desc&limit=10`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toLeadCandidate);
}

export async function findRecentCommercialLeads(input: {
	eventType?: string;
	packageInterest?: string;
	limit?: number;
}): Promise<CommercialLeadCandidate[]> {
	const filters = ['select=' + LEAD_SELECT, 'order=created_at.desc', `limit=${input.limit ?? 8}`];
	const eventType = emptyToUndefined(input.eventType);
	const packageInterest = emptyToUndefined(input.packageInterest);
	if (eventType) filters.push(`event_type=eq.${encodeURIComponent(eventType)}`);
	if (packageInterest) filters.push(`package_interest=eq.${encodeURIComponent(packageInterest)}`);

	const rows = await supabaseRestRequest<CommercialLeadRow[]>({
		pathWithQuery: `leads?${filters.join('&')}`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows.map(toLeadCandidate);
}

const CUSTOMER_SELECT =
	'id,display_name,email,phone_e164,referral_code,city,country,is_past_client,referral_credit_mxn';

function toCustomer(row: CommercialCustomerRow): CommercialCustomer {
	return {
		id: row.id,
		displayName: row.display_name,
		email: row.email,
		phoneE164: row.phone_e164,
		referralCode: row.referral_code ?? '',
		city: row.city ?? null,
		country: row.country?.trim() || 'MX',
		isPastClient: row.is_past_client === true,
		referralCreditMxn:
			typeof row.referral_credit_mxn === 'number'
				? row.referral_credit_mxn
				: typeof row.referral_credit_mxn === 'string'
					? Number(row.referral_credit_mxn) || 0
					: 0,
	};
}

export async function upsertCommercialCustomer(
	input: CommercialCustomerInput,
): Promise<CommercialCustomer> {
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?select=${CUSTOMER_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			display_name: input.displayName,
			email: emptyToUndefined(input.email),
			normalized_email: emptyToUndefined(input.normalizedEmail),
			phone_country_code: emptyToUndefined(input.phoneCountryCode),
			phone_national: emptyToUndefined(input.phoneNational),
			phone_e164: emptyToUndefined(input.phoneE164),
			created_from_lead_id: emptyToUndefined(input.createdFromLeadId),
			city: emptyToUndefined(input.city),
			country: emptyToUndefined(input.country)?.toUpperCase() ?? 'MX',
			...(input.isPastClient !== undefined ? { is_past_client: input.isPastClient } : {}),
			...(input.referralCode
				? { referral_code: normalizeReferralCode(input.referralCode) }
				: {}),
		},
	});
	const row = rows[0];
	if (!row) throw new Error('Customer upsert did not return a customer id.');
	return toCustomer(row);
}

export async function updateCommercialCustomerAttributes(input: {
	customerId: string;
	city?: string;
	country?: string;
	isPastClient?: boolean;
	referralCreditMxn?: number;
}): Promise<CommercialCustomer | null> {
	const body: Record<string, unknown> = {};
	const city = emptyToUndefined(input.city);
	const country = emptyToUndefined(input.country)?.toUpperCase();
	if (city !== undefined) body.city = city;
	if (country !== undefined) body.country = country;
	if (input.isPastClient !== undefined) body.is_past_client = input.isPastClient;
	if (input.referralCreditMxn !== undefined) {
		body.referral_credit_mxn = Math.max(0, Math.floor(input.referralCreditMxn));
	}
	if (Object.keys(body).length === 0) {
		return findCommercialCustomerById(input.customerId);
	}
	body.updated_at = new Date().toISOString();
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?id=eq.${encodeURIComponent(input.customerId)}&select=${CUSTOMER_SELECT}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});
	return rows[0] ? toCustomer(rows[0]) : null;
}

export async function linkCommercialLeadToCustomer(
	input: LinkCommercialLeadToCustomerInput,
): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: `leads?id=eq.${encodeURIComponent(input.leadId)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: {
			customer_id: input.customerId,
		},
	});
}

export async function findCommercialCustomerByEmail(
	normalizedEmail: string,
): Promise<CommercialCustomer | null> {
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?normalized_email=eq.${encodeURIComponent(normalizedEmail)}&select=${CUSTOMER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toCustomer(rows[0]) : null;
}

export async function findCommercialCustomerByPhone(
	phoneE164: string,
): Promise<CommercialCustomer | null> {
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?phone_e164=eq.${encodeURIComponent(phoneE164)}&select=${CUSTOMER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toCustomer(rows[0]) : null;
}

export async function findCommercialCustomerById(id: string): Promise<CommercialCustomer | null> {
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?id=eq.${encodeURIComponent(id)}&select=${CUSTOMER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toCustomer(rows[0]) : null;
}

export async function findCommercialCustomerByReferralCode(
	referralCode: string,
): Promise<CommercialCustomer | null> {
	const normalized = normalizeReferralCode(referralCode);
	if (!normalized) return null;
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: `customers?referral_code=eq.${encodeURIComponent(normalized)}&select=${CUSTOMER_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0] ? toCustomer(rows[0]) : null;
}

export async function listCustomersWithConfirmedSales(): Promise<CommercialCustomer[]> {
	interface ConfirmedOrderWithCustomerRow {
		id: string;
		customer_id: string;
		customers: CommercialCustomerRow | null;
	}
	interface ClassificationRow {
		record_type: string;
		record_id: string;
	}
	const [orderRows, classifications] = await Promise.all([
		supabaseRestRequest<ConfirmedOrderWithCustomerRow[]>({
			pathWithQuery: `sales_orders?status=in.(confirmed,deposit_paid,paid)&select=id,customer_id,customers(${CUSTOMER_SELECT})&order=created_at.desc&limit=5000`,
			method: 'GET',
			useServiceRole: true,
		}),
		supabaseRestRequest<ClassificationRow[]>({
			pathWithQuery:
				'commercial_record_classifications?classification=eq.test_qa&revoked_at=is.null&select=record_type,record_id&limit=5000',
			method: 'GET',
			useServiceRole: true,
		}).catch(() => [] as ClassificationRow[]),
	]);

	const excludedOrders = new Set(
		classifications.filter((c) => c.record_type === 'order').map((c) => c.record_id),
	);
	const excludedCustomers = new Set(
		classifications.filter((c) => c.record_type === 'customer').map((c) => c.record_id),
	);

	const uniqueCustomers = new Map<string, CommercialCustomer>();
	for (const row of orderRows) {
		if (!row.customers) continue;
		if (excludedOrders.has(row.id) || excludedCustomers.has(row.customer_id)) continue;
		if (!uniqueCustomers.has(row.customer_id)) {
			uniqueCustomers.set(row.customer_id, toCustomer(row.customers));
		}
	}
	return [...uniqueCustomers.values()];
}
