import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

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
	eventType?: string;
	packageInterest?: string;
	messageSummary?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
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

export async function upsertLead(input: LeadInput): Promise<StoredLead> {
	const rows = await supabaseRestRequest<
		Array<{ id: string; lead_code: string; status: LeadStatus }>
	>({
		pathWithQuery: 'leads?on_conflict=lead_code&select=id,lead_code,status',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=merge-duplicates,return=representation',
		body: {
			lead_code: input.leadCode,
			session_id: emptyToUndefined(input.sessionId),
			source_event_id: emptyToUndefined(input.sourceEventId),
			channel: input.channel,
			status: input.status ?? 'new',
			name: emptyToUndefined(input.name),
			email: emptyToUndefined(input.email),
			phone: emptyToUndefined(input.phone),
			event_type: emptyToUndefined(input.eventType),
			package_interest: emptyToUndefined(input.packageInterest),
			message_summary: emptyToUndefined(input.messageSummary),
			utm_source: emptyToUndefined(input.utmSource),
			utm_medium: emptyToUndefined(input.utmMedium),
			utm_campaign: emptyToUndefined(input.utmCampaign),
			consent_contact: input.consentContact,
			consent_marketing: input.consentMarketing,
		},
	});

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
