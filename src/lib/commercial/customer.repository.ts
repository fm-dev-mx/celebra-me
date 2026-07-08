import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

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
}

export interface CommercialCustomerInput {
	displayName: string;
	email?: string;
	normalizedEmail?: string;
	phoneCountryCode?: string;
	phoneNational?: string;
	phoneE164?: string;
	createdFromLeadId?: string;
}

export interface CommercialCustomer {
	id: string;
	displayName: string;
	email?: string | null;
	phoneE164?: string | null;
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
}

interface CommercialCustomerRow {
	id: string;
	display_name: string;
	email?: string | null;
	phone_e164?: string | null;
}

const LEAD_SELECT =
	'id,lead_code,channel,status,customer_id,name,email,phone,phone_e164,event_type,package_interest,utm_source,utm_medium,utm_campaign,created_at';

function emptyToUndefined(value: string | undefined): string | undefined {
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

export async function upsertCommercialCustomer(
	input: CommercialCustomerInput,
): Promise<CommercialCustomer> {
	const rows = await supabaseRestRequest<CommercialCustomerRow[]>({
		pathWithQuery: 'customers?select=id,display_name,email,phone_e164',
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
		},
	});
	const row = rows[0];
	if (!row) throw new Error('Customer upsert did not return a customer id.');
	return {
		id: row.id,
		displayName: row.display_name,
		email: row.email,
		phoneE164: row.phone_e164,
	};
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
