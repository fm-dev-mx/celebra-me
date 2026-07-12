import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { MetaAttribution } from '@/lib/tracking/meta-attribution';

export type LeadChannel = 'contact_form' | 'whatsapp' | 'manual';
export type LeadStatus =
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
	status?: LeadStatus;
	name?: string;
	email?: string;
	phone?: string;
	phoneCountryCode?: string;
	phoneNational?: string;
	phoneE164?: string;
	eventType?: string;
	packageInterest?: string;
	messageSummary?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	metaAttribution?: MetaAttribution;
	consentContact: boolean;
	consentMarketing: boolean;
}

export interface StoredLead {
	id: string;
	leadCode: string;
	status: LeadStatus;
}

function emptyToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export async function findLeadByCode(leadCode: string): Promise<StoredLead | null> {
	const rows = await supabaseRestRequest<
		Array<{ id: string; lead_code: string; status: LeadStatus }>
	>({
		pathWithQuery: `leads?lead_code=eq.${encodeURIComponent(leadCode)}&select=id,lead_code,status&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	if (rows.length === 0) return null;
	return { id: rows[0].id, leadCode: rows[0].lead_code, status: rows[0].status };
}

export async function upsertLead(input: LeadInput): Promise<StoredLead> {
	let rows = await supabaseRestRequest<
		Array<{ id: string; lead_code: string; status: LeadStatus }>
	>({
		pathWithQuery: 'leads?on_conflict=lead_code&select=id,lead_code,status',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			lead_code: input.leadCode,
			session_id: emptyToUndefined(input.sessionId),
			source_event_id: emptyToUndefined(input.sourceEventId),
			channel: input.channel,
			status: input.status ?? 'new',
			name: emptyToUndefined(input.name),
			email: emptyToUndefined(input.email),
			phone: emptyToUndefined(input.phone),
			phone_country_code: emptyToUndefined(input.phoneCountryCode),
			phone_national: emptyToUndefined(input.phoneNational),
			phone_e164: emptyToUndefined(input.phoneE164),
			event_type: emptyToUndefined(input.eventType),
			package_interest: emptyToUndefined(input.packageInterest),
			message_summary: emptyToUndefined(input.messageSummary),
			utm_source: emptyToUndefined(input.utmSource),
			utm_medium: emptyToUndefined(input.utmMedium),
			utm_campaign: emptyToUndefined(input.utmCampaign),
			fbp: emptyToUndefined(input.metaAttribution?.fbp),
			fbc: emptyToUndefined(input.metaAttribution?.fbc),
			fbclid: emptyToUndefined(input.metaAttribution?.fbclid),
			consent_contact: input.consentContact,
			consent_marketing: input.consentMarketing,
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
			['package_interest', emptyToUndefined(input.packageInterest)],
			['message_summary', emptyToUndefined(input.messageSummary)],
			['utm_source', emptyToUndefined(input.utmSource)],
			['utm_medium', emptyToUndefined(input.utmMedium)],
			['utm_campaign', emptyToUndefined(input.utmCampaign)],
			['fbp', emptyToUndefined(input.metaAttribution?.fbp)],
			['fbc', emptyToUndefined(input.metaAttribution?.fbc)],
			['fbclid', emptyToUndefined(input.metaAttribution?.fbclid)],
		];
		for (const [key, value] of optionalFields) {
			if (value !== undefined) updates[key] = value;
		}
		rows = await supabaseRestRequest<
			Array<{ id: string; lead_code: string; status: LeadStatus }>
		>({
			pathWithQuery: `leads?lead_code=eq.${encodeURIComponent(input.leadCode)}&select=id,lead_code,status`,
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

	return {
		id: row.id,
		leadCode: row.lead_code,
		status: row.status,
	};
}
