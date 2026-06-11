export const DEFAULT_PREVIEW_CONTEXT = {
	guestName: 'Invitado',
	eventTitle: 'tu evento',
	inviteUrl: 'https://celebra-me.com/i/ejemplo',
	eventDate: '15 de junio de 2026',
	daysUntilEvent: '5',
	rawDaysUntilEvent: null,
	rsvpDeadline: '10 de junio de 2026',
	eventTimingText: 'Te recordamos que faltan 5 días para tu evento.',
	rsvpDeadlineText: 'Confirma tu asistencia antes del 10 de junio de 2026.',
};

export const SHARE_MESSAGE_VARIABLES = [
	'{{invitado}}',
	'{{evento}}',
	'{{enlace}}',
	'{{fecha}}',
	'{{dias_faltantes}}',
	'{{fecha_limite}}',
	'{{hora_evento}}',
	'{{limite_confirmacion}}',
] as const;

export const SHARE_MESSAGE_VARIABLE_LABELS: Record<
	(typeof SHARE_MESSAGE_VARIABLES)[number],
	string
> = {
	'{{invitado}}': 'Invitado',
	'{{evento}}': 'Evento',
	'{{enlace}}': 'Enlace',
	'{{fecha}}': 'Fecha',
	'{{dias_faltantes}}': 'Días faltantes',
	'{{hora_evento}}': 'Hora del evento',
	'{{fecha_limite}}': 'Fecha límite',
	'{{limite_confirmacion}}': 'Límite de confirmación',
};

export const DEFAULT_INVITATION_MESSAGE =
	'Hola {{invitado}}, te comparto tu invitación a {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}';

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
	input?: Partial<ReminderSettings> | null | undefined,
): ReminderSettings {
	return {
		enabled:
			typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
		showWhenDaysBeforeEvent:
			typeof input?.showWhenDaysBeforeEvent === 'number' && input.showWhenDaysBeforeEvent >= 0
				? input.showWhenDaysBeforeEvent
				: DEFAULT_REMINDER_SETTINGS.showWhenDaysBeforeEvent,
		audience:
			input?.audience === 'unconfirmed' || input?.audience === 'all-shared'
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

export function resolveShareDescription(
	ogDescription: string | undefined | null,
	eventTitle: string | undefined | null,
): string {
	const custom = ogDescription?.trim();
	if (custom) return custom;
	const title = (eventTitle ?? '').trim() || 'la invitación';
	return `Consulta los detalles de ${title} y confirma tu asistencia.`;
}
