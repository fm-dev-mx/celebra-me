import { CONFIRMED_RSVP_TEXT } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';
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
	attendanceStatus?: AttendanceStatus;
}

const EVENT_TITLE_FALLBACK = 'nuestra celebraci\u00f3n';

const ALL_PLACEHOLDERS =
	/\{\{(invitado|evento|enlace|fecha|dias_faltantes|fecha_limite|hora_evento|limite_confirmacion)\}\}|\{(guestName|name|fullName|eventTitle|inviteUrl|eventDate|daysUntilEvent|rsvpDeadline|eventTimingText|rsvpDeadlineText)\}/g;

const ALIASES: Record<string, string> = {
	name: 'guestName',
	fullName: 'guestName',
	invitado: 'guestName',
	evento: 'eventTitle',
	enlace: 'inviteUrl',
	fecha: 'eventDate',
	dias_faltantes: 'daysUntilEvent',
	fecha_limite: 'rsvpDeadline',
	hora_evento: 'eventTimingText',
	limite_confirmacion: 'rsvpDeadlineText',
};

function resolveGuestName(raw: string | null | undefined): string {
	return raw ? sanitize(raw, 120) : '';
}

function resolveEventTitle(raw: string | null | undefined): string {
	const trimmed = raw ? sanitize(raw, 120) : '';
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

	const confirmedOverride = context.attendanceStatus === 'confirmed';

	const canonical: Record<string, string> = {
		guestName,
		eventTitle,
		inviteUrl: context.inviteUrl,
		eventDate: context.eventDate ?? '',
		daysUntilEvent: context.daysUntilEvent ?? '',
		rsvpDeadline: context.rsvpDeadline ?? '',
		eventTimingText: context.eventTimingText ?? '',
		rsvpDeadlineText: confirmedOverride
			? CONFIRMED_RSVP_TEXT
			: (context.rsvpDeadlineText ?? ''),
	};

	let result = template.replaceAll(ALL_PLACEHOLDERS, (_, spanishKey, legacyKey) => {
		const rawKey = spanishKey ?? legacyKey;
		return canonical[ALIASES[rawKey] ?? rawKey] ?? '';
	});

	if (!guestName) {
		result = cleanEmptyGreeting(result);
	}

	return result.replace(/\n{3,}/g, '\n\n').trim();
}
