export const DEFAULT_INVITATION_MESSAGE =
	'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nÁbrela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nAhí puedes revisar los detalles y confirmar tu asistencia.';

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
