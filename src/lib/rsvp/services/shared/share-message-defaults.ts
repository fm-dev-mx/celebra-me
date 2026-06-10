export const PREVIEW_CONTEXT = {
	guestName: 'María García',
	eventTitle: 'Nuestro evento',
	inviteUrl: 'https://celebra-me.com/invitacion/ejemplo',
	eventDate: '15 de junio de 2026',
	daysUntilEvent: '5',
	rsvpDeadline: '10 de junio de 2026',
	eventTimingText: 'Te recordamos que faltan 5 días para Nuestro evento.',
	rsvpDeadlineText: 'Confirma tu asistencia antes del 10 de junio de 2026.',
};

export const SHARE_MESSAGE_VARIABLES = [
	'{guestName}',
	'{eventTitle}',
	'{inviteUrl}',
	'{eventDate}',
	'{daysUntilEvent}',
	'{rsvpDeadline}',
	'{eventTimingText}',
	'{rsvpDeadlineText}',
] as const;

export const SHARE_MESSAGE_VARIABLE_LABELS: Record<string, string> = {
	'{guestName}': 'Nombre del invitado',
	'{eventTitle}': 'Título del evento',
	'{inviteUrl}': 'Enlace de invitación',
	'{eventDate}': 'Fecha del evento',
	'{daysUntilEvent}': 'Días restantes',
	'{rsvpDeadline}': 'Fecha límite de confirmación',
	'{eventTimingText}': 'Texto de tiempo restante',
	'{rsvpDeadlineText}': 'Texto de fecha límite',
};

export const DEFAULT_INVITATION_MESSAGE =
	'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\nÁbrela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {guestName},\n\n{eventTimingText}\n\n{rsvpDeadlineText}\n';

export interface ShareMessagesConfig {
	invitation: string;
	reminder: string;
}

export function resolveShareTemplates(config?: {
	shareMessages?: ShareMessagesConfig | null;
}): ShareMessagesConfig {
	return {
		invitation: config?.shareMessages?.invitation || DEFAULT_INVITATION_MESSAGE,
		reminder: config?.shareMessages?.reminder || DEFAULT_REMINDER_MESSAGE,
	};
}
