import { createHash } from 'node:crypto';
import { findCommercialCustomerByReferralCode } from '@/lib/commercial/customer.repository';
import { normalizeReferralCode } from '@/lib/commercial/referrals';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { MetaAttribution } from '@/lib/tracking/meta-attribution';

export type LeadChannel = 'contact_form' | 'whatsapp' | 'manual';
/** landing: the website created the lead; chat: the owner captured it from a WhatsApp chat. */
export type LeadRoute = 'landing' | 'chat';
type LeadStatus =
	| 'new'
	| 'contacted'
	| 'quoted'
	| 'production_authorized'
	| 'paid'
	| 'converted_to_demo'
	| 'lost'
	| 'spam';

export interface LeadInput {
	leadCode: string;
	sessionId?: string;
	sourceEventId?: string;
	channel: LeadChannel;
	route?: LeadRoute;
	/** Per-ad code from the lead_ad_codes catalog (chat route). */
	adCode?: string;
	status?: LeadStatus;
	name?: string;
	email?: string;
	phone?: string;
	phoneCountryCode?: string;
	phoneNational?: string;
	phoneE164?: string;
	eventType?: string;
	/** ISO date (YYYY-MM-DD) from the lead capture form. */
	eventDate?: string;
	celebrantNames?: string;
	demoSlug?: string;
	packageInterest?: string;
	messageSummary?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	utmContent?: string;
	ttclid?: string;
	metaAttribution?: MetaAttribution;
	consentContact: boolean;
	consentMarketing: boolean;
	isPastSale?: boolean;
	referredByCustomerId?: string;
	referralCodeUsed?: string;
	referrerExternalId?: string;
}

export interface StoredLead {
	id: string;
	leadCode: string;
	status: LeadStatus;
	sessionId: string | null;
	isPastSale?: boolean;
	referredByCustomerId?: string | null;
	referralCodeUsed?: string | null;
	referrerExternalId?: string | null;
}

function emptyToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function hashCustomerExternalId(customerId: string): string {
	return createHash('sha256').update(customerId.trim().toLowerCase()).digest('hex');
}

interface StoredLeadRow {
	id: string;
	lead_code: string;
	status: LeadStatus;
	session_id: string | null;
	is_past_sale?: boolean | null;
	referred_by_customer_id?: string | null;
	referral_code_used?: string | null;
	referrer_external_id?: string | null;
}

const STORED_LEAD_SELECT =
	'id,lead_code,status,session_id,is_past_sale,referred_by_customer_id,referral_code_used,referrer_external_id';

function toStoredLead(row: StoredLeadRow): StoredLead {
	return {
		id: row.id,
		leadCode: row.lead_code,
		status: row.status,
		sessionId: row.session_id,
		isPastSale: row.is_past_sale === true,
		referredByCustomerId: row.referred_by_customer_id ?? null,
		referralCodeUsed: row.referral_code_used ?? null,
		referrerExternalId: row.referrer_external_id ?? null,
	};
}

export async function findLeadByCode(leadCode: string): Promise<StoredLead | null> {
	const rows = await supabaseRestRequest<StoredLeadRow[]>({
		pathWithQuery: `leads?lead_code=eq.${encodeURIComponent(leadCode)}&select=${STORED_LEAD_SELECT}&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	if (rows.length === 0) return null;
	return toStoredLead(rows[0]);
}

export async function upsertLead(input: LeadInput): Promise<StoredLead> {
	let rows = await supabaseRestRequest<StoredLeadRow[]>({
		pathWithQuery: `leads?on_conflict=lead_code&select=${STORED_LEAD_SELECT}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			lead_code: input.leadCode,
			session_id: emptyToUndefined(input.sessionId),
			source_event_id: emptyToUndefined(input.sourceEventId),
			channel: input.channel,
			route: input.route,
			ad_code: emptyToUndefined(input.adCode),
			status: input.status ?? 'new',
			name: emptyToUndefined(input.name),
			email: emptyToUndefined(input.email),
			phone: emptyToUndefined(input.phone),
			phone_country_code: emptyToUndefined(input.phoneCountryCode),
			phone_national: emptyToUndefined(input.phoneNational),
			phone_e164: emptyToUndefined(input.phoneE164),
			event_type: emptyToUndefined(input.eventType),
			event_date: emptyToUndefined(input.eventDate),
			celebrant_names: emptyToUndefined(input.celebrantNames),
			demo_slug: emptyToUndefined(input.demoSlug),
			package_interest: emptyToUndefined(input.packageInterest),
			message_summary: emptyToUndefined(input.messageSummary),
			utm_source: emptyToUndefined(input.utmSource),
			utm_medium: emptyToUndefined(input.utmMedium),
			utm_campaign: emptyToUndefined(input.utmCampaign),
			utm_content: emptyToUndefined(input.utmContent),
			ttclid: emptyToUndefined(input.ttclid),
			fbp: emptyToUndefined(input.metaAttribution?.fbp),
			fbc: emptyToUndefined(input.metaAttribution?.fbc),
			fbclid: emptyToUndefined(input.metaAttribution?.fbclid),
			consent_contact: input.consentContact,
			consent_marketing: input.consentMarketing,
			...(input.isPastSale !== undefined ? { is_past_sale: input.isPastSale } : {}),
			referred_by_customer_id: emptyToUndefined(input.referredByCustomerId),
			referral_code_used: emptyToUndefined(input.referralCodeUsed),
			referrer_external_id: emptyToUndefined(input.referrerExternalId),
		},
	});
	if (rows.length === 0) {
		const updates: Record<string, unknown> = {
			consent_contact: input.consentContact,
			consent_marketing: input.consentMarketing,
		};
		const optionalFields: Array<[string, string | undefined]> = [
			['session_id', emptyToUndefined(input.sessionId)],
			['source_event_id', emptyToUndefined(input.sourceEventId)],
			['name', emptyToUndefined(input.name)],
			['email', emptyToUndefined(input.email)],
			['phone', emptyToUndefined(input.phone)],
			['phone_country_code', emptyToUndefined(input.phoneCountryCode)],
			['phone_national', emptyToUndefined(input.phoneNational)],
			['phone_e164', emptyToUndefined(input.phoneE164)],
			['event_type', emptyToUndefined(input.eventType)],
			['event_date', emptyToUndefined(input.eventDate)],
			['celebrant_names', emptyToUndefined(input.celebrantNames)],
			['demo_slug', emptyToUndefined(input.demoSlug)],
			['package_interest', emptyToUndefined(input.packageInterest)],
			['message_summary', emptyToUndefined(input.messageSummary)],
			['utm_source', emptyToUndefined(input.utmSource)],
			['utm_medium', emptyToUndefined(input.utmMedium)],
			['utm_campaign', emptyToUndefined(input.utmCampaign)],
			['utm_content', emptyToUndefined(input.utmContent)],
			['ttclid', emptyToUndefined(input.ttclid)],
			['route', input.route],
			['fbp', emptyToUndefined(input.metaAttribution?.fbp)],
			['fbc', emptyToUndefined(input.metaAttribution?.fbc)],
			['fbclid', emptyToUndefined(input.metaAttribution?.fbclid)],
			['referred_by_customer_id', emptyToUndefined(input.referredByCustomerId)],
			['referral_code_used', emptyToUndefined(input.referralCodeUsed)],
			['referrer_external_id', emptyToUndefined(input.referrerExternalId)],
		];
		for (const [key, value] of optionalFields) {
			if (value !== undefined) updates[key] = value;
		}
		if (!input.sessionId) {
			throw new Error('Lead code is already bound to another session.');
		}
		rows = await supabaseRestRequest<StoredLeadRow[]>({
			pathWithQuery: `leads?lead_code=eq.${encodeURIComponent(input.leadCode)}&session_id=eq.${encodeURIComponent(input.sessionId)}&select=${STORED_LEAD_SELECT}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: updates,
		});
	}

	const row = rows[0];
	if (!row) {
		throw new Error('Lead upsert did not return a lead id.');
	}

	return toStoredLead(row);
}

export interface LeadReferralAttribution {
	referredByCustomerId: string;
	referralCodeUsed: string;
	referrerExternalId: string;
}

/**
 * Resolves a customer referral code (`?ref=CODE`) for a lead under the first-referrer-wins rule:
 * - If the lead already has a `referred_by_customer_id`, keeps the existing referrer (returns undefined).
 * - If the person (by existing lead ID or `phoneE164`) already has a confirmed or paid order, returns undefined.
 * - Rejects self-referral (when the referrer customer has the same `phoneE164` or customer ID).
 */
export async function resolveLeadReferralAttribution(input: {
	referralCode?: string;
	existingLead?: StoredLead | null;
	phoneE164?: string;
	customerId?: string;
}): Promise<LeadReferralAttribution | undefined> {
	const code = normalizeReferralCode(input.referralCode);
	if (!code) return undefined;

	// First referrer wins: never overwrite an already-attributed lead.
	if (input.existingLead?.referredByCustomerId) return undefined;

	try {
		const referrer = await findCommercialCustomerByReferralCode(code);
		if (!referrer) return undefined;

		// Prevent self-referral by customer ID or phone.
		if (input.customerId && referrer.id === input.customerId) return undefined;
		if (input.phoneE164 && referrer.phoneE164 && referrer.phoneE164 === input.phoneE164) {
			return undefined;
		}

		// If the lead's phone belongs to an existing lead that already has a referrer or a confirmed sale,
		// respect first-referrer-wins and do not attach a referral to an existing buyer.
		if (input.phoneE164) {
			const priorLeads = await supabaseRestRequest<
				Array<{
					id: string;
					customer_id: string | null;
					referred_by_customer_id: string | null;
				}>
			>({
				pathWithQuery: `leads?phone_e164=eq.${encodeURIComponent(input.phoneE164)}&select=id,customer_id,referred_by_customer_id&limit=10`,
				method: 'GET',
				useServiceRole: true,
			});
			const priorReferrer = priorLeads.find(
				(row) =>
					row.referred_by_customer_id &&
					(!input.existingLead || row.id !== input.existingLead.id),
			);
			if (priorReferrer) return undefined;

			const leadIds = priorLeads.map((row) => row.id);
			const customerIds = [
				...new Set(
					[...priorLeads.map((row) => row.customer_id), input.customerId ?? null].filter(
						(id): id is string => Boolean(id),
					),
				),
			];

			if (customerIds.length > 0) {
				const existingOrders = await supabaseRestRequest<Array<{ id: string }>>({
					pathWithQuery: `sales_orders?customer_id=in.(${customerIds.map((id) => encodeURIComponent(id)).join(',')})&status=in.(confirmed,deposit_paid,paid)&select=id&limit=1`,
					method: 'GET',
					useServiceRole: true,
				});
				if (existingOrders.length > 0) return undefined;
			} else if (leadIds.length > 0) {
				const existingOrders = await supabaseRestRequest<Array<{ id: string }>>({
					pathWithQuery: `sales_orders?lead_id=in.(${leadIds.map((id) => encodeURIComponent(id)).join(',')})&status=in.(confirmed,deposit_paid,paid)&select=id&limit=1`,
					method: 'GET',
					useServiceRole: true,
				});
				if (existingOrders.length > 0) return undefined;
			}
		}

		return {
			referredByCustomerId: referrer.id,
			referralCodeUsed: referrer.referralCode || code,
			referrerExternalId: hashCustomerExternalId(referrer.id),
		};
	} catch {
		return undefined;
	}
}

export interface LeadOrderAttribution {
	leadId: string;
	sessionId: string | null;
	isPastSale?: boolean;
	referredByCustomerId?: string | null;
	referralCodeUsed?: string | null;
}

/**
 * The lead an order is attributed to: the given lead, or else the customer's latest lead. Its
 * session carries the Meta cookies a later Purchase needs.
 */
export async function findLeadOrderAttribution(input: {
	leadId?: string;
	customerId: string;
}): Promise<LeadOrderAttribution | null> {
	const filter = input.leadId
		? `id=eq.${encodeURIComponent(input.leadId)}`
		: `customer_id=eq.${encodeURIComponent(input.customerId)}&order=created_at.desc`;
	const rows = await supabaseRestRequest<
		Array<{
			id: string;
			session_id: string | null;
			is_past_sale?: boolean | null;
			referred_by_customer_id?: string | null;
			referral_code_used?: string | null;
		}>
	>({
		pathWithQuery: `leads?${filter}&select=id,session_id,is_past_sale,referred_by_customer_id,referral_code_used&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	if (rows.length === 0) return null;
	return {
		leadId: rows[0].id,
		sessionId: rows[0].session_id,
		isPastSale: rows[0].is_past_sale === true,
		referredByCustomerId: rows[0].referred_by_customer_id ?? null,
		referralCodeUsed: rows[0].referral_code_used ?? null,
	};
}

/**
 * The customer of the session's latest lead that gave marketing consent, so the session's later
 * browser events reach Meta with the customer's hashed phone.
 */
export async function findSessionLeadCustomerId(sessionId: string): Promise<string | null> {
	const rows = await supabaseRestRequest<Array<{ customer_id: string | null }>>({
		pathWithQuery: `leads?session_id=eq.${encodeURIComponent(sessionId)}&customer_id=not.is.null&consent_marketing=is.true&is_past_sale=is.false&select=customer_id&order=created_at.desc&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	return rows[0]?.customer_id ?? null;
}

/** Flags a lead as a past sale so no later Meta Lead or CRM stage event is enqueued for it. */
export async function markLeadAsPastSale(leadId: string): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: `leads?id=eq.${encodeURIComponent(leadId)}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: { is_past_sale: true },
	});
}
