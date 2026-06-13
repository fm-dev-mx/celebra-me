import { parsePhoneInput, stripAllNonDigits } from '@/lib/phone/validation';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';

// Shared RSVP state types.

export type AttendanceStatus = 'confirmed' | 'declined' | null;

export interface WhatsAppConfig {
	phone: string;
	confirmedTemplate?: string;
	declinedTemplate?: string;
	omitTitle?: boolean;
}

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
	attendanceStatus: AttendanceStatus;
	attendeeCount: number | string;
	supportsPlusOnes: boolean;
	effectiveGuestCap: number;
	isPublicRsvp?: boolean;
}

// RSVP form helpers.

const DEFAULT_SUBCOPY: Record<string, string> = {
	xv: 'Tu respuesta nos ayuda a preparar cada detalle de esta celebración especial.',
	boda: 'Tu confirmación nos ayuda a preparar cada detalle para compartir este día contigo.',
	bautizo: 'Tu respuesta nos ayuda a preparar cada detalle de esta celebración familiar.',
	cumple: 'Tu confirmación nos ayuda a preparar cada detalle de esta velada tan especial.',
	'baby-shower': 'Tu respuesta nos ayuda a preparar cada detalle para recibir a nuestro bebé.',
};

export function getDefaultRsvpSubcopy(eventType: string): string {
	return (
		DEFAULT_SUBCOPY[eventType] ??
		'Tu respuesta nos ayuda a preparar cada detalle de esta celebración especial.'
	);
}

export interface RsvpResponseMessages {
	confirmed?: { title?: string; subtitle?: string };
	declined?: { title?: string; subtitle?: string };
}

export function interpolateRsvpMessage(
	template: string,
	variables: { guestName?: string; celebrantName?: string },
): string {
	return template
		.replaceAll('{guestName}', variables.guestName ?? '')
		.replaceAll('{celebrantName}', variables.celebrantName ?? '');
}

export const RSVP_DEFAULT_RESPONSE_MESSAGES = {
	confirmed: {
		title: '¡Gracias por confirmar, {guestName}!',
		subtitle: 'Tu confirmación ha sido registrada.',
	},
	declined: {
		title: 'Sentimos mucho que no puedas acompañarnos, {guestName}.',
		subtitle: 'Gracias por avisarnos.',
	},
} as const;

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
): ResolvedLabels {
	const isEditorial = variant === 'editorial';

	return {
		nameLabel: labels?.name ?? 'Tu nombre',
		guestCountLabel: labels?.guestCount ?? 'Número de asistentes',
		phoneLabel: labels?.phone ?? 'Teléfono de contacto',
		attendanceLabel: labels?.attendance ?? 'Asistencia',
		buttonLabel: labels?.confirmButton ?? 'Confirmar asistencia',
		notesLabel:
			labels?.notesLabel ??
			(isEditorial
				? 'DEDICATORIA'
				: `Mensaje para ${celebrantName ? celebrantName.trim().split(/\s+/)[0] : 'el festejado'}`),
		notesPlaceholder:
			labels?.notesPlaceholder ??
			(isEditorial
				? `Escribe unas palabras para ${celebrantName ? celebrantName.trim().split(/\s+/)[0] : 'el festejado'}…`
				: `Escribe un mensaje para ${celebrantName ? celebrantName.trim().split(/\s+/)[0] : 'el festejado'}...`),
	};
}

export function parseAttendeeCount(attendeeCount: number | string): number {
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
	attendanceStatus: AttendanceStatus;
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
}: ValidationContext) {
	const errors: Record<string, string> = {};

	// For public RSVP, identity fields are hidden until attendance is selected.
	// Only validate them once attendance has been chosen.
	const identityFieldsVisible = isPublicRsvp ? attendanceStatus !== null : true;

	if (!nameLocked && identityFieldsVisible && !name.trim()) {
		errors.name = 'Por favor, escribe tu nombre completo.';
	}
	if (identityFieldsVisible) {
		const normalizedPhone = normalizePhoneInput(phone);
		if (phoneRequired && !normalizedPhone) {
			errors.phone = 'Por favor, escribe tu teléfono.';
		} else if (normalizedPhone && normalizedPhone.length !== 10) {
			errors.phone = 'Escribe un teléfono de 10 dígitos.';
		}
	}
	if (!attendanceStatus) {
		errors.attendance = 'Por favor, selecciona si asistirás.';
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
	attendanceStatus: AttendanceStatus,
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
