import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';
import type { EventType } from '@/lib/theme/theme-contract';

export const DEFAULT_PREVIEW_CONTEXT = {
	guestName: 'Invitado',
	eventTitle: 'tu evento',
	inviteUrl: 'https://celebra-me.com/i/ejemplo',
	eventDate: '15 de junio de 2026',
	daysUntilEvent: '5',
	rawDaysUntilEvent: null,
	rsvpDeadline: '10 de junio de 2026',
	eventTimingText: 'Faltan 5 días para la celebración.',
	rsvpDeadlineText: 'Favor de confirmar su asistencia antes del 10 de junio de 2026.',
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

export type ShareMessageVariable = (typeof SHARE_MESSAGE_VARIABLES)[number];

export const INVITATION_TAB_VARIABLES: ShareMessageVariable[] = [
	'{{invitado}}',
	'{{evento}}',
	'{{enlace}}',
	'{{fecha}}',
	'{{fecha_limite}}',
];

export const REMINDER_TAB_VARIABLES: ShareMessageVariable[] = [
	'{{invitado}}',
	'{{evento}}',
	'{{enlace}}',
	'{{hora_evento}}',
	'{{dias_faltantes}}',
	'{{limite_confirmacion}}',
	'{{fecha}}',
	'{{fecha_limite}}',
];

export const SHARE_MESSAGE_VARIABLE_LABELS: Record<ShareMessageVariable, string> = {
	'{{invitado}}': 'Invitado',
	'{{evento}}': 'Evento',
	'{{enlace}}': 'Enlace',
	'{{fecha}}': 'Fecha',
	'{{dias_faltantes}}': 'Días faltantes',
	'{{hora_evento}}': 'Hora del evento',
	'{{fecha_limite}}': 'Fecha límite',
	'{{limite_confirmacion}}': 'Límite de confirmación',
};

export const SHARE_MESSAGE_VARIABLE_TOOLTIPS: Record<ShareMessageVariable, string> = {
	'{{invitado}}': 'Inserta el nombre personalizado de cada invitado',
	'{{evento}}': 'Inserta el nombre o título de la celebración',
	'{{enlace}}': 'Inserta el enlace único y seguro para abrir la invitación',
	'{{fecha}}': 'Inserta la fecha formal del evento',
	'{{dias_faltantes}}': 'Inserta el número de días que faltan',
	'{{hora_evento}}': 'Inserta el texto recordatorio con los días restantes',
	'{{fecha_limite}}': 'Inserta la fecha máxima para confirmar',
	'{{limite_confirmacion}}': 'Inserta la solicitud de confirmación con fecha límite',
};

export const DEFAULT_INVITATION_MESSAGE =
	'Hola {{invitado}}, te comparto tu invitación a {{evento}}:\n\n{{enlace}}\n\nÁbrela para ver los detalles y confirmar tu asistencia.';

export const DEFAULT_REMINDER_MESSAGE =
	'Hola {{invitado}},\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}';

export const CONFIRMED_RSVP_TEXT =
	'Ya tenemos registrada tu asistencia. Te esperamos con mucho gusto.';

// V1 system-generated reminder (observed in persisted data). Kept so the normalization layer
// still recognizes it as a default and can swap it for the status-aware variant.
export const LEGACY_REMINDER_TEMPLATE_V1 =
	'Hola {guestName}, te recordamos tu invitación a los {eventTitle}.\n\n{eventTimingText}\n\nPor favor confirma tu asistencia aquí:';

export const DEFAULT_REMINDER_MESSAGE_CONFIRMED = `Hola {{invitado}},\n\n{{hora_evento}}\n\n${CONFIRMED_RSVP_TEXT}\n\nPuedes consultar nuevamente los detalles del evento aquí:\n{{enlace}}`;

// ─── Event-specific Professional Defaults (Formal / "Usted" Register) ────────────

export const EVENT_SPECIFIC_INVITATION_MESSAGES: Record<EventType, string> = {
	boda: 'Hola {{invitado}}, nos llena de alegría compartirle la invitación a nuestra boda:\n\n{{enlace}}\n\nLe invitamos a conocer todos los detalles y confirmar su asistencia. ¡Será un honor contar con su compañía en este día tan especial!',
	xv: 'Hola {{invitado}}, le comparto con mucha ilusión la invitación a mis XV años:\n\n{{enlace}}\n\nLe invito a conocer todos los detalles y confirmar su asistencia. ¡Me dará mucha alegría que me acompañe a celebrar!',
	bautizo:
		'Hola {{invitado}}, con inmensa alegría le compartimos la invitación a la celebración del Bautismo:\n\n{{enlace}}\n\nLe invitamos a conocer los detalles de la ceremonia y recepción, y a confirmar su asistencia. Será una bendición contar con su presencia en esta fecha tan significativa.',
	'baby-shower':
		'Hola {{invitado}}, con gran ilusión le compartimos la invitación a nuestro Baby Shower:\n\n{{enlace}}\n\nLe invitamos a abrir el enlace para conocer la fecha, ubicación, mesa de regalos y confirmar su asistencia. ¡Nos encantará festejar juntos!',
	'primera-comunion':
		'Hola {{invitado}}, tenemos el honor de compartirle la invitación a la Primera Comunión:\n\n{{enlace}}\n\nLe invitamos a abrir el enlace para conocer los detalles de la ceremonia religiosa y recepción, y confirmar su asistencia. Será un momento muy especial para nuestra familia.',
	cumple: 'Hola {{invitado}}, le comparto con mucho gusto la invitación a la fiesta de cumpleaños:\n\n{{enlace}}\n\nLe invito a abrir el enlace para conocer la ubicación, detalles y confirmar su asistencia. ¡Será un gran gusto contar con su compañía para festejar!',
};

export const EVENT_SPECIFIC_REMINDER_MESSAGES: Record<EventType, string> = {
	boda: 'Hola {{invitado}}, le recordamos con mucha ilusión que se acerca la celebración de nuestro matrimonio.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar la ubicación y detalles del evento en el siguiente enlace:\n{{enlace}}',
	xv: 'Hola {{invitado}}, le recuerdo con mucho cariño que se acerca la fiesta de mis XV años.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar el itinerario y detalles del evento en el siguiente enlace:\n{{enlace}}',
	bautizo:
		'Hola {{invitado}}, le recordamos con mucho cariño que se acerca la celebración del Bautismo.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar los horarios y detalles de la recepción en el siguiente enlace:\n{{enlace}}',
	'baby-shower':
		'Hola {{invitado}}, le recordamos con mucho cariño que se acerca la fecha de nuestro Baby Shower.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar la ubicación y mesa de regalos en el siguiente enlace:\n{{enlace}}',
	'primera-comunion':
		'Hola {{invitado}}, le recordamos con cariño que se acerca la celebración de Primera Comunión.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar los horarios y detalles del evento en el siguiente enlace:\n{{enlace}}',
	cumple: 'Hola {{invitado}}, le recordamos con mucho gusto que se acerca la fiesta de cumpleaños.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\nPuede consultar la ubicación y horarios del festejo en el siguiente enlace:\n{{enlace}}',
};

export const EVENT_SPECIFIC_REMINDER_CONFIRMED: Record<EventType, string> = {
	boda: 'Hola {{invitado}}, ¡nos emociona mucho que se acerque el día de nuestro matrimonio!\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia y será un honor compartir este momento juntos. Puede consultar nuevamente el itinerario y la ubicación aquí:\n{{enlace}}',
	xv: 'Hola {{invitado}}, ¡la cuenta regresiva para mis XV años continúa!\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia. Muchas gracias por acompañarme, le comparto nuevamente los detalles de la fiesta y la ubicación:\n{{enlace}}',
	bautizo:
		'Hola {{invitado}}, con mucha alegría esperamos la próxima celebración del Bautismo.\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia. Puede consultar nuevamente los horarios y la ubicación de la ceremonia y recepción aquí:\n{{enlace}}',
	'baby-shower':
		'Hola {{invitado}}, ¡nos llena de ilusión que se acerque la fecha de nuestro Baby Shower!\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia. Puede volver a consultar los detalles y sugerencias de regalos aquí:\n{{enlace}}',
	'primera-comunion':
		'Hola {{invitado}}, esperamos con mucha devoción y alegría la celebración de Primera Comunión.\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia. Puede consultar nuevamente los horarios y la ubicación aquí:\n{{enlace}}',
	cumple: 'Hola {{invitado}}, ¡ya casi es momento de festejar este cumpleaños!\n\n{{hora_evento}}\n\nYa tenemos registrada su asistencia. Le comparto nuevamente la ubicación y horarios del festejo:\n{{enlace}}',
};

export function getDefaultInvitationTemplate(eventType?: EventType | string): string {
	if (eventType && eventType in EVENT_SPECIFIC_INVITATION_MESSAGES) {
		return EVENT_SPECIFIC_INVITATION_MESSAGES[eventType as EventType];
	}
	return DEFAULT_INVITATION_MESSAGE;
}

export function getDefaultReminderTemplate(
	status: AttendanceStatus | undefined,
	eventType?: EventType | string,
): string {
	if (eventType && eventType in EVENT_SPECIFIC_REMINDER_MESSAGES) {
		const type = eventType as EventType;
		if (status === 'confirmed') return EVENT_SPECIFIC_REMINDER_CONFIRMED[type];
		return EVENT_SPECIFIC_REMINDER_MESSAGES[type];
	}

	if (status === 'confirmed') return DEFAULT_REMINDER_MESSAGE_CONFIRMED;
	return DEFAULT_REMINDER_MESSAGE;
}

const ALL_EVENT_REMINDERS = [
	...Object.values(EVENT_SPECIFIC_REMINDER_MESSAGES),
	...Object.values(EVENT_SPECIFIC_REMINDER_CONFIRMED),
];

const KNOWN_DEFAULT_REMINDER_TEMPLATES = [
	DEFAULT_REMINDER_MESSAGE,
	DEFAULT_REMINDER_MESSAGE_CONFIRMED,
	LEGACY_REMINDER_TEMPLATE_V1,
	...ALL_EVENT_REMINDERS,
] as const;

function normalizeReminderTemplate(template: string): string {
	return template.replace(/\r\n/g, '\n').trim();
}

const NORMALIZED_DEFAULT_REMINDER_TEMPLATES =
	KNOWN_DEFAULT_REMINDER_TEMPLATES.map(normalizeReminderTemplate);

export function isDefaultReminderTemplate(template?: string | null): boolean {
	if (!template) return true;

	return NORMALIZED_DEFAULT_REMINDER_TEMPLATES.includes(normalizeReminderTemplate(template));
}

export function resolveReminderTemplate(
	template: string | null | undefined,
	attendanceStatus?: AttendanceStatus,
	eventType?: EventType | string,
): string {
	if (isDefaultReminderTemplate(template)) {
		return getDefaultReminderTemplate(attendanceStatus, eventType);
	}

	return template ?? '';
}

export interface ShareMessagesConfig {
	invitation: string;
	reminder: string;
}

export function createShareMessages(
	invitation: string,
	eventType?: EventType | string,
): ShareMessagesConfig {
	return { invitation, reminder: getDefaultReminderTemplate('pending', eventType) };
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
	eventType?: EventType | string,
): ShareMessagesConfig {
	return {
		invitation: shareMessages?.invitation || getDefaultInvitationTemplate(eventType),
		reminder: shareMessages?.reminder || getDefaultReminderTemplate('pending', eventType),
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

// ─── Quick Presets (One-click message tone selection) ────────────────────────────

export interface MessagePreset {
	id: 'recommended' | 'warm' | 'brief';
	label: string;
	description: string;
	invitation: string;
	reminder: string;
}

function getEventMention(eventType?: EventType | string): string {
	switch (eventType) {
		case 'boda':
			return 'a nuestra boda';
		case 'xv':
			return 'a mis XV años';
		case 'bautizo':
			return 'al Bautismo';
		case 'baby-shower':
			return 'a nuestro Baby Shower';
		case 'primera-comunion':
			return 'a la Primera Comunión';
		case 'cumple':
			return 'a la fiesta de cumpleaños';
		default:
			return 'a {{evento}}';
	}
}

function getEventApproaching(eventType?: EventType | string): string {
	switch (eventType) {
		case 'boda':
			return 'que se acerca nuestra boda';
		case 'xv':
			return 'que se acerca la fiesta de mis XV años';
		case 'bautizo':
			return 'que se acerca la celebración del Bautismo';
		case 'baby-shower':
			return 'que se acerca nuestro Baby Shower';
		case 'primera-comunion':
			return 'que se acerca la Primera Comunión';
		case 'cumple':
			return 'que se acerca la fiesta de cumpleaños';
		default:
			return 'que se acerca {{evento}}';
	}
}

export function getSuggestedPresets(eventType?: EventType | string): MessagePreset[] {
	const recommendedInv = getDefaultInvitationTemplate(eventType);
	const recommendedRem = getDefaultReminderTemplate('pending', eventType);

	const eventMention = getEventMention(eventType);
	const eventApproaching = getEventApproaching(eventType);

	const warmInvitation =
		eventType === 'xv'
			? `Hola {{invitado}}, con mucha alegría y cariño le comparto la invitación ${eventMention}:\n\n{{enlace}}\n\nEspero de corazón contar con su presencia para celebrar juntos este día tan especial.`
			: `Hola {{invitado}}, con mucha alegría y cariño queremos compartirle nuestra invitación ${eventMention}:\n\n{{enlace}}\n\nEsperamos de corazón contar con su presencia para celebrar juntos este día tan especial.`;

	return [
		{
			id: 'recommended',
			label: 'Elegante',
			description: 'Tono formal y respetuoso, recomendado para el evento',
			invitation: recommendedInv,
			reminder: recommendedRem,
		},
		{
			id: 'warm',
			label: 'Cálido',
			description: 'Tono emotivo y cercano, ideal para familiares y amigos',
			invitation: warmInvitation,
			reminder: `Hola {{invitado}}, le recordamos con mucho cariño ${eventApproaching}.\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n¡Nos encantará contar con su compañía! Puede consultar los detalles aquí:\n{{enlace}}`,
		},
		{
			id: 'brief',
			label: 'Breve',
			description: 'Mensaje conciso y directo',
			invitation: `Hola {{invitado}}, le comparto la invitación ${eventMention}:\n\n{{enlace}}\n\nFavor de abrir el enlace para ver los detalles y confirmar su asistencia.`,
			reminder: `Hola {{invitado}}, le recordamos la invitación ${eventMention}:\n\n{{hora_evento}}\n\n{{limite_confirmacion}}\n\n{{enlace}}`,
		},
	];
}

// ─── Smart Variable Insertion (Prevents adjacent tags & duplicates) ──────────────

export interface SmartInsertResult {
	newText: string;
	newCursorPos: number;
	wasDuplicate: boolean;
}

export function smartInsertVariable(
	currentText: string,
	selectionStart: number,
	selectionEnd: number,
	variable: string,
): SmartInsertResult {
	const before = currentText.substring(0, selectionStart);
	const after = currentText.substring(selectionEnd);

	// Prevent duplicate if the exact same variable is immediately before or after
	if (before.trimEnd().endsWith(variable) || after.trimStart().startsWith(variable)) {
		return {
			newText: currentText,
			newCursorPos: selectionStart,
			wasDuplicate: true,
		};
	}

	// Add leading space if previous char exists and isn't whitespace or newline
	const needsLeadingSpace = before.length > 0 && !/[\s\n]$/.test(before);

	// Add trailing space if next char exists and isn't whitespace, newline, or punctuation
	const needsTrailingSpace = after.length > 0 && !/^[\s\n.,:;!?]/.test(after);

	const prefix = needsLeadingSpace ? ' ' : '';
	const suffix = needsTrailingSpace ? ' ' : '';
	const insertString = `${prefix}${variable}${suffix}`;

	const newText = before + insertString + after;
	const newCursorPos = selectionStart + insertString.length;

	return {
		newText,
		newCursorPos,
		wasDuplicate: false,
	};
}
