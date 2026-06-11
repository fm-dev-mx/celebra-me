export const PREVIEW_CONTEXT = {
	guestName: 'María García',
	eventTitle: 'Mi Bautizo y 1er Año de César Ramsés',
	inviteUrl: 'https://celebra-me.com/i/abc123',
	eventDate: '15 de junio de 2026',
	daysUntilEvent: '5',
	rsvpDeadline: '10 de junio de 2026',
	eventTimingText: 'Te recordamos que faltan 5 días para Mi Bautizo y 1er Año de César Ramsés.',
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

export const SHARE_MESSAGE_VARIABLE_LABELS: Record<
	(typeof SHARE_MESSAGE_VARIABLES)[number],
	string
> = {
	'{guestName}': 'Invitado',
	'{eventTitle}': 'Evento',
	'{inviteUrl}': 'Link',
	'{eventDate}': 'Fecha',
	'{daysUntilEvent}': 'Días faltantes',
	'{rsvpDeadline}': 'Fecha límite',
	'{eventTimingText}': 'Tiempo del evento',
	'{rsvpDeadlineText}': 'Límite de confirmación',
};

export const DEFAULT_INVITATION_MESSAGE =
	'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\nÁbrela para ver los detalles y confirmar tu asistencia.\n\n{inviteUrl}';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {guestName},\n\n{eventTimingText}\n\n{rsvpDeadlineText}\n\n{inviteUrl}';

export interface ShareMessagesConfig {
	invitation: string;
	reminder: string;
}

export type ReminderAudience = 'unconfirmed' | 'all-shared';

export interface ReminderSettings {
	enabled: boolean;
	showWhenDaysBeforeEvent: number;
	audience: ReminderAudience;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
	enabled: true,
	showWhenDaysBeforeEvent: 70,
	audience: 'unconfirmed',
};

export function resolveReminderSettings(
	input?: ReminderSettings | null | undefined,
): ReminderSettings {
	if (!input) return { ...DEFAULT_REMINDER_SETTINGS };
	return {
		enabled:
			typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
		showWhenDaysBeforeEvent:
			typeof input.showWhenDaysBeforeEvent === 'number' && input.showWhenDaysBeforeEvent >= 0
				? input.showWhenDaysBeforeEvent
				: DEFAULT_REMINDER_SETTINGS.showWhenDaysBeforeEvent,
		audience:
			input.audience === 'unconfirmed' || input.audience === 'all-shared'
				? input.audience
				: DEFAULT_REMINDER_SETTINGS.audience,
	};
}

export function resolveShareTemplates(
	shareMessages?: ShareMessagesConfig | null,
): ShareMessagesConfig {
	return {
		invitation: shareMessages?.invitation || DEFAULT_INVITATION_MESSAGE,
		reminder: shareMessages?.reminder || DEFAULT_REMINDER_MESSAGE,
	};
}

export const DEFAULT_SHARE_DESCRIPTION_TEMPLATE =
	'Consulta los detalles de {eventTitle} y confirma tu asistencia.';

export function resolveShareDescription(
	ogDescription: string | undefined | null,
	eventTitle: string | undefined | null,
): string {
	const customDescription = ogDescription?.trim();
	const resolvedEventTitle = (eventTitle ?? '').trim() || 'la invitación';

	if (customDescription) return customDescription;

	return DEFAULT_SHARE_DESCRIPTION_TEMPLATE.replace('{eventTitle}', resolvedEventTitle);
}
