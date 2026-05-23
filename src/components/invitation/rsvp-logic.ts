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

export function formatCelebrantName(name?: string): string {
	return name ? name.trim().split(/\s+/)[0] : 'el festejado';
}

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
): ResolvedLabels {
	return {
		nameLabel: labels?.name ?? 'Tu nombre',
		guestCountLabel: labels?.guestCount ?? 'N\u00famero de asistentes',
		phoneLabel: labels?.phone ?? 'Tel\u00e9fono de contacto',
		attendanceLabel: labels?.attendance ?? 'Asistencia',
		buttonLabel: labels?.confirmButton ?? 'Confirmar asistencia',
		notesLabel: labels?.notesLabel ?? 'Mensaje para el festejado',
		notesPlaceholder:
			labels?.notesPlaceholder ??
			`Escribe un mensaje para ${formatCelebrantName(celebrantName)}...`,
	};
}

export function parseAttendeeCount(attendeeCount: number | string) {
	return typeof attendeeCount === 'string' ? parseInt(attendeeCount, 10) : attendeeCount;
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
		? 'Hola, soy {name}. Lamentablemente no podr\u00e9 asistir.'
		: 'Hola, soy {name}. Lamentablemente no podr\u00e9 asistir a {title}.';

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
			errors.phone = 'Por favor, escribe tu tel\u00e9fono.';
		} else if (normalizedPhone && normalizedPhone.length !== 10) {
			errors.phone = 'Escribe un tel\u00e9fono de 10 d\u00edgitos.';
		}
	}
	if (!attendanceStatus) {
		errors.attendance = 'Por favor, selecciona si asistir\u00e1s.';
	}
	if (attendanceStatus === 'confirmed') {
		const normalizedCount = supportsPlusOnes ? parseAttendeeCount(attendeeCount) : 1;
		if (!normalizedCount || normalizedCount < 1) {
			errors.guestCount = 'El n\u00famero de invitados debe ser al menos 1.';
		} else if (normalizedCount > effectiveGuestCap) {
			errors.guestCount = `El l\u00edmite de invitados es de ${effectiveGuestCap}.`;
		}
	}

	return errors;
}

export function normalizeGuestCount(
	attendanceStatus: AttendanceStatus,
	attendeeCount: number | string,
	supportsPlusOnes: boolean,
) {
	if (attendanceStatus !== 'confirmed') return 0;
	const parsedCount = parseAttendeeCount(attendeeCount) || 1;
	return supportsPlusOnes ? parsedCount : 1;
}

export function coerceAttendeeCount(
	status: AttendanceStatus,
	previousCount: number | string,
	supportsPlusOnes: boolean,
	effectiveGuestCap: number,
): number {
	if (status !== 'confirmed') return 0;
	if (!supportsPlusOnes) return 1;
	const parsed = parseAttendeeCount(previousCount);
	const safe = parsed && parsed >= 1 ? parsed : 1;
	return Math.min(safe, effectiveGuestCap);
}
