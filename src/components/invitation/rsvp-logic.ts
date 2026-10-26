import { parsePhoneInput, stripAllNonDigits } from '@/lib/phone/validation';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';
import type { WhatsAppConfig } from '@/lib/adapters/types';
export type { RsvpResponseMessages } from '@/lib/invitation/rsvp-messages';

/**
 * Platform default: every invitation allows guests to change their RSVP
 * response after submission. This is a deliberate product decision — no
 * per-invitation opt-in is required. Individual routes may still override
 * this by passing `allowResponseEditing={false}` to the RSVP component.
 */
/** Fictitious guest shown in demo previews. Lives here so the RSVP island stays free of SSR code. */
export const DEMO_GUEST_NAME = 'María Fernanda Solís';

export const ALLOW_RESPONSE_EDITING_BY_DEFAULT = true;

// Shared RSVP state types.

export type RsvpAttendanceChoice = 'confirmed' | 'declined' | null;

export interface ResolvedLabels {
	nameLabel: string;
	guestCountLabel: string;
	phoneLabel: string;
	attendanceLabel: string;
	buttonLabel: string;
	notesLabel: string;
	notesPlaceholder: string;
}

export interface ValidationContext {
	name: string;
	phone: string;
	phoneRequired: boolean;
	nameLocked: boolean;
	attendanceStatus: RsvpAttendanceChoice;
	attendeeCount: number | string;
	supportsPlusOnes: boolean;
	effectiveGuestCap: number;
	isPublicRsvp?: boolean;
	copy?: RsvpDefaultCopy;
}

const VALIDATION_MESSAGES: Record<
	RsvpDefaultCopy,
	Record<'name' | 'phone' | 'phoneLength' | 'attendance', string>
> = {
	usted: {
		name: 'Por favor, escriba su nombre completo.',
		phone: 'Por favor, escriba su teléfono.',
		phoneLength: 'Escriba un teléfono de 10 dígitos.',
		attendance: 'Por favor, indique si asistirá.',
	},
	legacy: {
		name: 'Por favor, escribe tu nombre completo.',
		phone: 'Por favor, escribe tu teléfono.',
		phoneLength: 'Escribe un teléfono de 10 dígitos.',
		attendance: 'Por favor, selecciona si asistirás.',
	},
};

// RSVP form helpers.

/**
 * Which default copy an invitation reads: `usted` for every invitation, `legacy` (the earlier
 * «tú» wording) only for those that keep it (src/lib/invitation/legacy-rsvp-defaults.ts).
 */
export type RsvpDefaultCopy = 'usted' | 'legacy';

const DEFAULT_SUBCOPY: Record<RsvpDefaultCopy, Record<string, string>> = {
	usted: {
		xv: 'Su respuesta nos ayuda a preparar cada detalle de esta celebración especial.',
		boda: 'Su confirmación nos ayuda a preparar cada detalle para compartir este día con usted.',
		bautizo: 'Su respuesta nos ayuda a preparar cada detalle de esta celebración familiar.',
		cumple: 'Su confirmación nos ayuda a preparar cada detalle de esta velada tan especial.',
		'baby-shower':
			'Su respuesta nos ayuda a preparar cada detalle para recibir a nuestro bebé.',
		'primera-comunion':
			'Su respuesta nos ayuda a preparar cada detalle de esta celebración de fe.',
	},
	legacy: {
		xv: 'Tu respuesta nos ayuda a preparar cada detalle de esta celebración especial.',
		boda: 'Tu confirmación nos ayuda a preparar cada detalle para compartir este día contigo.',
		bautizo: 'Tu respuesta nos ayuda a preparar cada detalle de esta celebración familiar.',
		cumple: 'Tu confirmación nos ayuda a preparar cada detalle de esta velada tan especial.',
		'baby-shower':
			'Tu respuesta nos ayuda a preparar cada detalle para recibir a nuestro bebé.',
		'primera-comunion':
			'Tu respuesta nos ayuda a preparar cada detalle de esta celebración de fe.',
	},
};

export function getDefaultRsvpSubcopy(eventType: string, copy: RsvpDefaultCopy = 'usted'): string {
	const subcopy = DEFAULT_SUBCOPY[copy];
	return subcopy[eventType] ?? subcopy.xv;
}

export function interpolateRsvpMessage(
	template: string,
	variables: { guestName?: string; celebrantName?: string },
): string {
	return template
		.replaceAll('{guestName}', variables.guestName ?? '')
		.replaceAll('{celebrantName}', variables.celebrantName ?? '');
}

type RsvpResponseStatus = 'confirmed' | 'declined';
type ResponseMessage = { title: string; subtitle: string };

// The confirmation card above already thanks the guest (confirmationMessage), so the «usted» title
// states the result instead of thanking a second time.
const RSVP_DEFAULT_RESPONSE_MESSAGES: Record<
	RsvpDefaultCopy,
	Record<RsvpResponseStatus, ResponseMessage>
> = {
	usted: {
		confirmed: {
			title: 'Asistencia confirmada, {guestName}.',
			subtitle: 'Su respuesta quedó registrada.',
		},
		declined: {
			title: 'Sentimos mucho que no pueda acompañarnos, {guestName}.',
			subtitle: 'Gracias por avisarnos.',
		},
	},
	legacy: {
		confirmed: {
			title: '¡Gracias por confirmar, {guestName}!',
			subtitle: 'Tu confirmación ha sido registrada.',
		},
		declined: {
			title: 'Sentimos mucho que no puedas acompañarnos, {guestName}.',
			subtitle: 'Gracias por avisarnos.',
		},
	},
};

/** Title when the guest's name is unknown, replacing a default title that greets by name. */
const RSVP_NAMELESS_TITLES: Record<RsvpDefaultCopy, Record<RsvpResponseStatus, string>> = {
	usted: {
		confirmed: 'Asistencia confirmada.',
		declined: 'Sentimos mucho que no pueda acompañarnos.',
	},
	legacy: {
		confirmed: '¡Gracias por confirmar su asistencia!',
		declined: 'Gracias por avisarnos.',
	},
};

const DEFAULT_RESPONSE_MESSAGES_BY_EVENT_TYPE: Partial<
	Record<string, Record<RsvpDefaultCopy, Partial<Record<RsvpResponseStatus, ResponseMessage>>>>
> = {
	'primera-comunion': {
		usted: {
			confirmed: {
				title: 'Confirmación recibida',
				subtitle:
					'Su asistencia quedó registrada. Será un honor compartir este día con usted.',
			},
		},
		legacy: {
			confirmed: {
				title: 'Confirmación recibida',
				subtitle:
					'Tu asistencia ha quedado registrada. Será un honor compartir este día contigo.',
			},
		},
	},
};

export function getDefaultResponseMessages(
	eventType: string | undefined,
	statusKey: RsvpResponseStatus,
	copy: RsvpDefaultCopy = 'usted',
): ResponseMessage {
	const eventDefaults = eventType
		? DEFAULT_RESPONSE_MESSAGES_BY_EVENT_TYPE[eventType]?.[copy]
		: undefined;
	return eventDefaults?.[statusKey] ?? RSVP_DEFAULT_RESPONSE_MESSAGES[copy][statusKey];
}

export function getNamelessResponseTitle(
	statusKey: RsvpResponseStatus,
	copy: RsvpDefaultCopy = 'usted',
): string {
	return RSVP_NAMELESS_TITLES[copy][statusKey];
}

/** Hint under the attendee count; `{count}` is the places reserved for the guest. */
export function getDefaultGuestHint(copy: RsvpDefaultCopy = 'usted'): string {
	return copy === 'legacy'
		? 'Hemos reservado {count} lugares para tu invitación. Puedes ajustar el número si asistirán menos personas.'
		: 'Hemos reservado {count} lugares para su invitación. Puede ajustar el número si asistirán menos personas.';
}

const LABEL_WORDS: Record<RsvpDefaultCopy, { name: string; write: string }> = {
	usted: { name: 'Su nombre', write: 'Escriba' },
	legacy: { name: 'Tu nombre', write: 'Escribe' },
};

export function resolveLabels(
	labels?: {
		name?: string;
		guestCount?: string;
		attendance?: string;
		confirmButton?: string;
		phone?: string;
		notesLabel?: string;
		notesPlaceholder?: string;
	},
	celebrantName?: string,
	variant?: string,
	copy: RsvpDefaultCopy = 'usted',
): ResolvedLabels {
	const isEditorial = ['editorial-press-pass', 'editorial'].includes(variant ?? '');
	const celebrantFirstName = celebrantName?.trim().split(/\s+/)[0] || 'el festejado';
	const { name, write } = LABEL_WORDS[copy];

	return {
		nameLabel: labels?.name ?? name,
		guestCountLabel: labels?.guestCount ?? 'Número de asistentes',
		phoneLabel: labels?.phone ?? 'Teléfono de contacto',
		attendanceLabel: labels?.attendance ?? 'Asistencia',
		buttonLabel: labels?.confirmButton ?? 'Confirmar asistencia',
		notesLabel:
			labels?.notesLabel ??
			(isEditorial ? 'DEDICATORIA' : `Mensaje para ${celebrantFirstName}`),
		notesPlaceholder:
			labels?.notesPlaceholder ??
			defaultNotesPlaceholder(write, isEditorial, celebrantFirstName),
	};
}

function defaultNotesPlaceholder(write: string, isEditorial: boolean, firstName: string): string {
	return isEditorial
		? `${write} unas palabras para ${firstName}…`
		: `${write} un mensaje para ${firstName}...`;
}

function parseAttendeeCount(attendeeCount: number | string): number {
	const n = typeof attendeeCount === 'string' ? parseInt(attendeeCount, 10) : attendeeCount;
	return Number.isNaN(n) ? 0 : n;
}

/**
 * Normalizes a phone input for RSVP submission.
 * Strips formatting and returns clean digits.
 */
export function normalizePhoneInput(phone: string) {
	return stripAllNonDigits(phone).slice(0, 10);
}

/**
 * Parses an RSVP phone input.
 * - Empty → returns empty phone + default country code
 * - Starts with '+' → delegates to parsePhoneInput, fallback to raw digits
 * - Plain digits → returns as-is with DEFAULT_COUNTRY_CODE
 */
export function parseRsvpPhoneInput(input: string): { phone: string; countryCode: string } {
	const result = parsePhoneInput(input);
	if (result.ok) {
		return { phone: result.phone, countryCode: result.countryCode };
	}
	const digits = stripAllNonDigits(input);
	return { phone: digits.slice(0, 10), countryCode: DEFAULT_COUNTRY_CODE };
}

export function buildWhatsAppUrl(params: {
	whatsappConfig?: WhatsAppConfig;
	attendanceStatus: RsvpAttendanceChoice;
	attendeeCount: number | string;
	name: string;
	title: string;
}) {
	const { whatsappConfig, attendanceStatus, attendeeCount, name, title } = params;
	if (!whatsappConfig?.phone) return '';

	const isConfirmed = attendanceStatus === 'confirmed';
	const omitTitleByDefault = Boolean(whatsappConfig.omitTitle);

	const defaultConfirmedTemplate = omitTitleByDefault
		? 'Hola, soy {name}. Confirmo mi asistencia. Asistiremos {guestCount} persona(s).'
		: 'Hola, soy {name}. Confirmo mi asistencia a {title}. Asistiremos {guestCount} persona(s).';
	const defaultDeclinedTemplate = omitTitleByDefault
		? 'Hola, soy {name}. Lamentablemente no podré asistir.'
		: 'Hola, soy {name}. Lamentablemente no podré asistir a {title}.';

	const template =
		(isConfirmed ? whatsappConfig.confirmedTemplate : whatsappConfig.declinedTemplate) ??
		(isConfirmed ? defaultConfirmedTemplate : defaultDeclinedTemplate);
	const guestCount = isConfirmed ? Math.max(1, parseAttendeeCount(attendeeCount) || 1) : 0;

	const message = template
		.replaceAll('{name}', name)
		.replaceAll('{guestCount}', String(guestCount))
		.replaceAll('{title}', title);

	return `https://wa.me/${whatsappConfig.phone}?text=${encodeURIComponent(message)}`;
}

export function validateRsvpForm({
	name,
	phone,
	phoneRequired,
	nameLocked,
	attendanceStatus,
	attendeeCount,
	supportsPlusOnes,
	effectiveGuestCap,
	isPublicRsvp,
	copy = 'usted',
}: ValidationContext) {
	const errors: Record<string, string> = {};
	const messages = VALIDATION_MESSAGES[copy];

	// For public RSVP, identity fields are hidden until attendance is selected.
	// Only validate them once attendance has been chosen.
	const identityFieldsVisible = isPublicRsvp ? attendanceStatus !== null : true;

	if (!nameLocked && identityFieldsVisible && !name.trim()) {
		errors.name = messages.name;
	}
	if (identityFieldsVisible) {
		const normalizedPhone = normalizePhoneInput(phone);
		if (phoneRequired && !normalizedPhone) {
			errors.phone = messages.phone;
		} else if (normalizedPhone && normalizedPhone.length !== 10) {
			errors.phone = messages.phoneLength;
		}
	}
	if (!attendanceStatus) {
		errors.attendance = messages.attendance;
	}
	if (attendanceStatus === 'confirmed') {
		const normalizedCount = supportsPlusOnes ? parseAttendeeCount(attendeeCount) : 1;
		if (!normalizedCount || normalizedCount < 1) {
			errors.guestCount = 'El número de invitados debe ser al menos 1.';
		} else if (normalizedCount > effectiveGuestCap) {
			errors.guestCount = `El límite de invitados es de ${effectiveGuestCap}.`;
		}
	}

	return errors;
}

export function normalizeGuestCount(
	attendanceStatus: RsvpAttendanceChoice,
	attendeeCount: number | string,
	supportsPlusOnes: boolean,
	effectiveGuestCap?: number,
): number {
	if (attendanceStatus !== 'confirmed') return 0;
	if (!supportsPlusOnes) return 1;
	const parsed = parseAttendeeCount(attendeeCount);
	const safe = parsed >= 1 ? parsed : 1;
	return effectiveGuestCap !== undefined ? Math.min(safe, effectiveGuestCap) : safe;
}
