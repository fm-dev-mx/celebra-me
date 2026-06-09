export const DEFAULT_SHARE_MESSAGE_WITH_PHONE =
	'Hola {guestName}, nos dará mucho gusto contar contigo en {eventTitle}.\n\nAquí puedes ver tu invitación:\n{inviteUrl}\n\nÁbrela para consultar los detalles y confirmar tu asistencia.';

export const DEFAULT_SHARE_MESSAGE_WITHOUT_PHONE =
	'Nos dará mucho gusto contar contigo en {eventTitle}.\n\nAquí puedes ver la invitación:\n{inviteUrl}\n\nÁbrela para consultar los detalles y confirmar tu asistencia.';

export interface ShareMessagesConfig {
	whatsappWithPhone: string;
	whatsappWithoutPhone: string;
}
