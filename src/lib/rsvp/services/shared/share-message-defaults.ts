export const DEFAULT_SHARE_MESSAGE_WITH_PHONE =
	'Hola {guestName}, te compartimos tu invitaci\u00f3n a {eventTitle}:\n\n{inviteUrl}\n\n\u00c1brela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_SHARE_MESSAGE_WITHOUT_PHONE =
	'Te compartimos esta invitaci\u00f3n a {eventTitle}:\n\n{inviteUrl}\n\n\u00c1brela para ver los detalles y confirmar tu asistencia.';

export interface ShareMessagesConfig {
	whatsappWithPhone: string;
	whatsappWithoutPhone: string;
}
