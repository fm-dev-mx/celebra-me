import { z } from 'zod';
import { createLeadCode } from '@/lib/tracking/lead-code';
import {
	upsertLead,
	findLeadByCode,
	type StoredLead,
	type LeadChannel,
} from '@/lib/tracking/lead.repository';
import { insertTrackingEvent } from '@/lib/tracking/repository';

const LeadCodeSchema = z
	.string()
	.trim()
	.regex(/^CM-[A-Z0-9]{6}$/)
	.optional()
	.or(z.literal(''));

export const ContactLeadSubmissionSchema = z.object({
	name: z.string().trim().min(2).max(160),
	email: z.email().optional().or(z.literal('')),
	phone: z.string().trim().max(40).optional().or(z.literal('')),
	eventType: z.string().trim().max(80).optional().or(z.literal('')),
	packageInterest: z.string().trim().max(80).optional().or(z.literal('')),
	message: z.string().trim().min(10).max(2000),
	consentContact: z.coerce.boolean().default(true),
	consentMarketing: z.coerce.boolean().default(false),
	leadCode: LeadCodeSchema,
	sessionId: z.uuid().optional().or(z.literal('')),
	sourceEventId: z.uuid().optional().or(z.literal('')),
	visitorId: z.string().trim().min(6).max(120).optional().or(z.literal('')),
	utmSource: z.string().trim().max(120).optional().or(z.literal('')),
	utmMedium: z.string().trim().max(120).optional().or(z.literal('')),
	utmCampaign: z.string().trim().max(180).optional().or(z.literal('')),
});

export type ContactLeadSubmission = z.input<typeof ContactLeadSubmissionSchema>;

function blankToUndefined(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function summarizeMessage(message: string): string {
	return message.trim().replace(/\s+/g, ' ').slice(0, 500);
}

export async function createLeadFromContactSubmission(
	submission: ContactLeadSubmission,
): Promise<StoredLead> {
	const parsed = ContactLeadSubmissionSchema.parse(submission);

	const leadCode = blankToUndefined(parsed.leadCode) ?? createLeadCode();
	// knownNew: true = confirmed new, false = confirmed existing, undefined = lookup failed
	let knownNew: boolean | undefined;
	if (blankToUndefined(parsed.leadCode)) {
		try {
			knownNew = (await findLeadByCode(leadCode)) === null;
		} catch {
			knownNew = undefined; // lookup failed → skip lead_created
		}
	} else {
		knownNew = true; // newly-generated code is always new
	}

	const lead = await upsertLead({
		leadCode,
		sessionId: blankToUndefined(parsed.sessionId),
		sourceEventId: blankToUndefined(parsed.sourceEventId),
		channel: 'contact_form',
		name: parsed.name,
		email: blankToUndefined(parsed.email),
		phone: blankToUndefined(parsed.phone),
		eventType: blankToUndefined(parsed.eventType),
		packageInterest: blankToUndefined(parsed.packageInterest),
		messageSummary: summarizeMessage(parsed.message),
		utmSource: blankToUndefined(parsed.utmSource),
		utmMedium: blankToUndefined(parsed.utmMedium),
		utmCampaign: blankToUndefined(parsed.utmCampaign),
		consentContact: parsed.consentContact,
		consentMarketing: parsed.consentMarketing,
	});

	// Fire lead_created event server-side — only for new leads.
	const visitorId = blankToUndefined(parsed.visitorId);
	const sessionId = blankToUndefined(parsed.sessionId);
	if (knownNew && visitorId && sessionId) {
		void insertTrackingEvent({
			sessionId,
			visitorId,
			eventName: 'lead_created',
			routePath: '/api/contact',
			routeClass: 'commercial',
			eventProperties: {
				lead_code: lead.leadCode,
				lead_channel: 'contact_form',
			},
			consentSnapshot: { necessary: true, analytics: false, marketing: false },
			isInternal: false,
		}).catch(() => {
			// Non-critical: lead is already persisted.
		});
	}

	return lead;
}

export async function createLeadFromTrackingEvent(params: {
	leadCode: string;
	sessionId: string;
	sourceEventId: string;
	channel: LeadChannel;
	visitorId: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
}): Promise<StoredLead> {
	const {
		leadCode,
		sessionId,
		sourceEventId,
		channel,
		visitorId,
		utmSource,
		utmMedium,
		utmCampaign,
	} = params;

	// Check whether a lead already exists for this lead_code.
	// On lookup failure, still create the lead but skip lead_created
	// to avoid counting an uncertain conversion.
	let existing: StoredLead | null | undefined;
	try {
		existing = await findLeadByCode(leadCode);
	} catch {
		existing = undefined; // lookup failed → skip lead_created
	}
	if (existing) {
		return existing; // confirmed existing, no lead_created
	}

	const lead = await upsertLead({
		leadCode,
		sessionId,
		sourceEventId,
		channel,
		status: 'new',
		consentContact: true,
		consentMarketing: false,
		utmSource: blankToUndefined(utmSource),
		utmMedium: blankToUndefined(utmMedium),
		utmCampaign: blankToUndefined(utmCampaign),
	});

	// Fire lead_created event — only for confirmed-new leads (existing === null).
	if (existing === null) {
		try {
			await insertTrackingEvent({
				sessionId,
				visitorId,
				eventName: 'lead_created',
				routePath: '/api/tracking/events',
				routeClass: 'commercial',
				eventProperties: {
					lead_code: lead.leadCode,
					lead_channel: channel,
				},
				consentSnapshot: { necessary: true, analytics: false, marketing: false },
				isInternal: false,
			});
		} catch {
			// Non-critical: lead is already persisted.
		}
	}

	return lead;
}
