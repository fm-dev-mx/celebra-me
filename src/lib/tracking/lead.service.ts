import { z } from 'zod';
import { createLeadCode } from '@/lib/tracking/lead-code';
import { upsertLead, type StoredLead } from '@/lib/tracking/lead.repository';

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

	return upsertLead({
		leadCode: blankToUndefined(parsed.leadCode) ?? createLeadCode(),
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
}
