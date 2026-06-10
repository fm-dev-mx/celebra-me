import { sanitize } from '@/lib/rsvp/core/utils';

export interface ShareMessageContext {
	guestName?: string | null;
	eventTitle?: string | null;
	inviteUrl: string;
	eventDate?: string | null;
	daysUntilEvent?: string | null;
	rsvpDeadline?: string | null;
	eventTimingText?: string | null;
	rsvpDeadlineText?: string | null;
}

const EVENT_TITLE_FALLBACK = 'nuestra celebraci\u00f3n';

const ALL_PLACEHOLDERS =
	/\{(guestName|name|fullName|eventTitle|inviteUrl|eventDate|daysUntilEvent|rsvpDeadline|eventTimingText|rsvpDeadlineText)\}/g;

function resolveGuestName(raw: string | null | undefined): string {
	if (!raw) return '';
	const trimmed = sanitize(raw, 120);
	return trimmed;
}

function resolveEventTitle(raw: string | null | undefined): string {
	if (!raw) return EVENT_TITLE_FALLBACK;
	const trimmed = sanitize(raw, 120);
	return trimmed || EVENT_TITLE_FALLBACK;
}

function cleanEmptyGreeting(message: string): string {
	return message
		.replace(/Hola\s*,\s*/g, '')
		.replace(/Hola\s+/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function renderShareMessage(template: string, context: ShareMessageContext): string {
	const guestName = resolveGuestName(context.guestName);
	const eventTitle = resolveEventTitle(context.eventTitle);
	const inviteUrl = context.inviteUrl;

	const vars: Record<string, string> = {
		guestName,
		name: guestName,
		fullName: guestName,
		eventTitle,
		inviteUrl,
		eventDate: context.eventDate ?? '',
		daysUntilEvent: context.daysUntilEvent ?? '',
		rsvpDeadline: context.rsvpDeadline ?? '',
		eventTimingText: context.eventTimingText ?? '',
		rsvpDeadlineText: context.rsvpDeadlineText ?? '',
	};
	let result = template.replaceAll(ALL_PLACEHOLDERS, (_, key) => vars[key as keyof typeof vars]);

	if (!guestName) {
		result = cleanEmptyGreeting(result);
	}

	return result.replace(/\n{3,}/g, '\n\n').trim();
}
