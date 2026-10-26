/**
 * «Datos de su invitación»: the private form a client fills in after the deposit
 * (`/mi-invitacion/<token>`). Shared by the form island, its API and the dashboard viewer, so it
 * holds no server code; the answer schema lives in `answers-schema.ts`.
 */

export type InvitationDataFieldKind = 'text' | 'textarea' | 'date' | 'time' | 'url' | 'photos';

export const INVITATION_DATA_ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
] as const;

export type InvitationDataAllowedMimeType = (typeof INVITATION_DATA_ALLOWED_MIME_TYPES)[number];

export const INVITATION_DATA_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const INVITATION_DATA_MAX_PHOTOS = 10;

export interface InvitationDataPhoto {
	id: string;
	url: string;
	name: string;
	size: number;
	type: string;
	uploadedAt?: string;
}

export interface InvitationDataField {
	name: InvitationDataFieldName;
	label: string;
	kind: InvitationDataFieldKind;
	maxLength: number;
	placeholder?: string;
	help?: string;
	/** Needed to send the form; drafts may leave it empty. */
	requiredToSubmit?: boolean;
}

export interface InvitationDataStep {
	id: string;
	title: string;
	intro: string;
	fields: InvitationDataField[];
}

export const INVITATION_DATA_TEXT_FIELD_NAMES = [
	'celebrantNames',
	'eventDate',
	'invitationTitle',
	'mainMessage',
	'parents',
	'godparents',
	'ceremonyVenue',
	'ceremonyAddress',
	'ceremonyTime',
	'ceremonyMapUrl',
	'receptionVenue',
	'receptionAddress',
	'receptionTime',
	'receptionMapUrl',
	'dressCode',
	'itinerary',
	'giftRegistry',
	'giftTransfer',
	'song',
	'notes',
] as const;

export const INVITATION_DATA_FIELD_NAMES = [...INVITATION_DATA_TEXT_FIELD_NAMES, 'photos'] as const;

export type InvitationDataFieldName = (typeof INVITATION_DATA_FIELD_NAMES)[number];
export type InvitationDataTextFieldName = (typeof INVITATION_DATA_TEXT_FIELD_NAMES)[number];

export type InvitationDataAnswers = Partial<Record<InvitationDataTextFieldName, string>> & {
	photos?: InvitationDataPhoto[];
};

export const INVITATION_DATA_STEPS: readonly InvitationDataStep[] = [
	{
		id: 'celebracion',
		title: 'Su celebración',
		intro: 'Lo principal de su invitación. Lo demás puede completarlo después.',
		fields: [
			{
				name: 'celebrantNames',
				label: 'Nombre(s) de quien celebra',
				kind: 'text',
				maxLength: 120,
				placeholder: 'Ej.: Andrea · Daniela y Martín',
				requiredToSubmit: true,
			},
			{
				name: 'eventDate',
				label: 'Fecha del evento',
				kind: 'date',
				maxLength: 10,
				requiredToSubmit: true,
			},
			{
				name: 'invitationTitle',
				label: 'Título de la invitación (opcional)',
				kind: 'text',
				maxLength: 120,
				placeholder: 'Ej.: Mis XV años',
			},
			{
				name: 'mainMessage',
				label: 'Mensaje principal',
				kind: 'textarea',
				maxLength: 1200,
				help: 'Puede usar una sugerencia y cambiarla a su gusto.',
			},
		],
	},
	{
		id: 'familia',
		title: 'Familia y padrinos',
		intro: 'Escriba un nombre por línea. Si no aplica, déjelo en blanco.',
		fields: [
			{
				name: 'parents',
				label: 'Padres',
				kind: 'textarea',
				maxLength: 600,
				placeholder: 'Ej.:\nGloria Garza\nRoberto Pérez',
			},
			{
				name: 'godparents',
				label: 'Padrinos (nombre y de qué)',
				kind: 'textarea',
				maxLength: 1200,
				placeholder: 'Ej.:\nLucía y Arturo Duarte — Padrinos de anillo',
			},
		],
	},
	{
		id: 'lugares',
		title: 'Ceremonia y recepción',
		intro: 'Copie el enlace de Google Maps desde «Compartir» para que sus invitados lleguen sin perderse.',
		fields: [
			{
				name: 'ceremonyVenue',
				label: 'Lugar de la ceremonia',
				kind: 'text',
				maxLength: 160,
				placeholder: 'Ej.: Parroquia de San José',
			},
			{
				name: 'ceremonyAddress',
				label: 'Dirección de la ceremonia',
				kind: 'textarea',
				maxLength: 300,
			},
			{ name: 'ceremonyTime', label: 'Hora de la ceremonia', kind: 'time', maxLength: 5 },
			{
				name: 'ceremonyMapUrl',
				label: 'Enlace de Google Maps de la ceremonia',
				kind: 'url',
				maxLength: 500,
				placeholder: 'https://maps.app.goo.gl/…',
			},
			{
				name: 'receptionVenue',
				label: 'Lugar de la recepción',
				kind: 'text',
				maxLength: 160,
				placeholder: 'Ej.: Salón Jardín Real',
			},
			{
				name: 'receptionAddress',
				label: 'Dirección de la recepción',
				kind: 'textarea',
				maxLength: 300,
			},
			{ name: 'receptionTime', label: 'Hora de la recepción', kind: 'time', maxLength: 5 },
			{
				name: 'receptionMapUrl',
				label: 'Enlace de Google Maps de la recepción',
				kind: 'url',
				maxLength: 500,
				placeholder: 'https://maps.app.goo.gl/…',
			},
			{
				name: 'dressCode',
				label: 'Código de vestimenta (opcional)',
				kind: 'text',
				maxLength: 160,
				placeholder: 'Ej.: Formal',
			},
		],
	},
	{
		id: 'itinerario',
		title: 'Itinerario',
		intro: 'Una actividad por línea, con su hora.',
		fields: [
			{
				name: 'itinerary',
				label: 'Itinerario',
				kind: 'textarea',
				maxLength: 1500,
				placeholder: 'Ej.:\n7:00 p. m. — Misa\n9:00 p. m. — Recepción\n10:00 p. m. — Vals',
			},
		],
	},
	{
		id: 'regalos',
		title: 'Mesa de regalos',
		intro: 'Solo si desea mostrarla en su invitación.',
		fields: [
			{
				name: 'giftRegistry',
				label: 'Mesa de regalos',
				kind: 'textarea',
				maxLength: 1000,
				placeholder: 'Ej.: Liverpool, evento 51234567',
			},
			{
				name: 'giftTransfer',
				label: 'Datos para transferencia (opcional)',
				kind: 'textarea',
				maxLength: 600,
				help: 'Se mostrarán en su invitación tal como los escriba.',
			},
		],
	},
	{
		id: 'fotos',
		title: 'Fotos para su invitación',
		intro: 'Suba las fotos que desea incluir en su diseño (máximo 10 fotos, hasta 10 MB cada una en formato JPG, PNG o WebP).',
		fields: [
			{
				name: 'photos',
				label: 'Fotos de la invitación',
				kind: 'photos',
				maxLength: 10,
				help: 'Suba hasta 10 fotos en formato JPG, PNG o WebP (máximo 10 MB cada una).',
			},
		],
	},
	{
		id: 'musica',
		title: 'Música y detalles',
		intro: 'Si tiene una canción especial o detalles adicionales, anótelos aquí.',
		fields: [
			{
				name: 'song',
				label: 'Canción de su invitación',
				kind: 'text',
				maxLength: 200,
				placeholder: 'Ej.: A Thousand Years — Christina Perri',
			},
			{
				name: 'notes',
				label: '¿Algo más que debamos saber?',
				kind: 'textarea',
				maxLength: 1000,
			},
		],
	},
];

export const INVITATION_DATA_FIELDS: readonly InvitationDataField[] = INVITATION_DATA_STEPS.flatMap(
	(step) => step.fields,
);

const MESSAGE_SUGGESTIONS: Record<string, readonly string[]> = {
	xv: [
		'Hay momentos inolvidables que se atesoran en el corazón para siempre. Por eso quiero que compartan conmigo el día de mis XV años.',
		'Con la bendición de Dios y el amor de mis padres, tengo el gusto de invitarles a celebrar mis XV años.',
	],
	boda: [
		'Con la bendición de Dios y de nuestros padres, tenemos el honor de invitarles a celebrar nuestra boda.',
		'Nuestra historia continúa y queremos que sean parte de ella. Acompáñennos a celebrar nuestro matrimonio.',
	],
	bautizo: [
		'Con mucha alegría les invitamos a acompañarnos en el bautizo de nuestro bebé.',
		'Un pequeño gran paso en la fe. Les esperamos para celebrar juntos este día tan especial.',
	],
	'primera-comunion': [
		'Con alegría en el corazón les invito a celebrar conmigo mi Primera Comunión.',
		'Recibiré a Jesús por primera vez y me encantaría que me acompañaran en este día.',
	],
	cumple: [
		'Un año más de vida merece celebrarse con las personas que más quiero. ¡Les espero!',
		'Acompáñenme a celebrar mi cumpleaños con mucha alegría.',
	],
	'baby-shower': [
		'Muy pronto llegará un nuevo integrante a la familia. Acompáñennos a celebrar su llegada.',
		'Les invitamos a compartir con nosotros la alegría de esta dulce espera.',
	],
};

/** Ready-made main messages for the event type; empty for an unknown type. */
export function suggestMainMessages(eventType: string | null | undefined): readonly string[] {
	return (eventType && MESSAGE_SUGGESTIONS[eventType]) || [];
}

export type InvitationDataIssues = Partial<Record<InvitationDataFieldName, string>>;

/** Drops empty answers so stored drafts only carry what the client wrote. */
export function compactInvitationDataAnswers(
	answers: InvitationDataAnswers,
): InvitationDataAnswers {
	const compact: InvitationDataAnswers = {};
	for (const name of INVITATION_DATA_TEXT_FIELD_NAMES) {
		const value = answers[name]?.trim();
		if (value) compact[name] = value;
	}
	if (Array.isArray(answers.photos) && answers.photos.length > 0) {
		compact.photos = answers.photos;
	}
	return compact;
}

/** Field errors that block sending the form (drafts are saved regardless). */
export function findMissingRequiredFields(answers: InvitationDataAnswers): InvitationDataIssues {
	const issues: InvitationDataIssues = {};
	for (const field of INVITATION_DATA_FIELDS) {
		if (field.requiredToSubmit) {
			if (field.name === 'photos') {
				if (!answers.photos || answers.photos.length === 0) {
					issues.photos = 'Este dato es necesario para enviar el formulario.';
				}
			} else {
				const text = answers[field.name as InvitationDataTextFieldName];
				if (!text?.trim()) {
					issues[field.name] = 'Este dato es necesario para enviar el formulario.';
				}
			}
		}
	}
	return issues;
}

export type InvitationDataStatus = 'sent' | 'in_progress' | 'submitted';

/** WhatsApp message the owner sends with the private link. */
export function buildInvitationDataWhatsAppMessage(input: {
	customerName?: string | null;
	link: string;
}): string {
	const firstName = input.customerName?.trim().split(/\s+/u)[0];
	const greeting = firstName ? `Hola, ${firstName}.` : 'Hola.';
	return [
		`${greeting} ¡Gracias por su anticipo!`,
		'Para preparar su invitación, llene sus datos en este enlace privado. Se guarda solo y puede volver a él cuando quiera:',
		input.link,
		'Las fotos puede mandarlas por aquí, por WhatsApp.',
	].join('\n\n');
}
