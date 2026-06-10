export const DEFAULT_INVITATION_MESSAGE =
	'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nÁbrela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nAhí puedes revisar los detalles y confirmar tu asistencia.';

export const DEFAULT_SHARE_MESSAGE_WITH_PHONE = DEFAULT_INVITATION_MESSAGE;
export const DEFAULT_SHARE_MESSAGE_WITHOUT_PHONE =
	'Nos dará mucho gusto contar contigo en {eventTitle}.\n\nAquí puedes ver la invitación:\n{inviteUrl}\n\nÁbrela para consultar los detalles y confirmar tu asistencia.';

export interface ShareMessagesConfig {
	invitation: string;
	reminder: string;
}
