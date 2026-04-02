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
}

// RSVP form helpers.

export function resolveLabels(labels?: {
	name?: string;
	guestCount?: string;
	attendance?: string;
	confirmButton?: string;
}): ResolvedLabels {
	return {
		nameLabel: labels?.name ?? 'Nombre completo \u002a',
		guestCountLabel: labels?.guestCount ?? 'N\u00famero total de asistentes',
		phoneLabel: 'Tel\u00e9fono de contacto',
		attendanceLabel: labels?.attendance ?? '\u00bfAsistir\u00e1s al evento? \u002a',
		buttonLabel: labels?.confirmButton ?? 'Confirmar',
	};
}

export function parseAttendeeCount(attendeeCount: number | string) {
	return typeof attendeeCount === 'string' ? parseInt(attendeeCount, 10) : attendeeCount;
}

export function normalizePhoneInput(phone: string) {
	return phone.replace(/[^\d]/g, '').slice(0, 10);
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
}: ValidationContext) {
	const errors: Record<string, string> = {};

	if (!nameLocked && !name.trim()) {
		errors.name = 'Por favor, escribe tu nombre completo.';
	}
	const normalizedPhone = normalizePhoneInput(phone);
	if (phoneRequired && !normalizedPhone) {
		errors.phone = 'Por favor, escribe tu tel\u00e9fono.';
	} else if (normalizedPhone && normalizedPhone.length !== 10) {
		errors.phone = 'Escribe un tel\u00e9fono de 10 d\u00edgitos.';
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
