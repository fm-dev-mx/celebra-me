export type PresetSection =
	| 'quote'
	| 'description'
	| 'familyMessage'
	| 'thankYou'
	| 'dressCode'
	| 'gifts'
	| 'rsvpTitle'
	| 'rsvpMessage';

export interface TextPreset {
	id: string;
	label: string;
	section: PresetSection;
	eventTypes?: string[];
	text: string;
}

export const TEXT_PRESETS: TextPreset[] = [
	// Quotes
	{
		id: 'quote-xv-1',
		label: 'Alegría de compartir',
		section: 'quote',
		eventTypes: ['xv'],
		text: 'La alegría de compartir este momento especial con quienes más quiero',
	},
	{
		id: 'quote-boda-1',
		label: 'El amor es la fuerza',
		section: 'quote',
		eventTypes: ['boda'],
		text: 'El amor es la fuerza más humilde, pero la más poderosa de que dispone el mundo',
	},
	{
		id: 'quote-bautizo-1',
		label: 'Regalo de vida y fe',
		section: 'quote',
		eventTypes: ['bautizo'],
		text: 'Hoy celebramos el regalo de la vida y la fe',
	},
	{
		id: 'quote-cumple-1',
		label: 'Un año más de vida',
		section: 'quote',
		eventTypes: ['cumple'],
		text: 'Un año más de vida, un motivo más para celebrar',
	},

	// Descriptions
	{
		id: 'desc-xv-1',
		label: 'Invitación a XV años',
		section: 'description',
		eventTypes: ['xv'],
		text: 'Con mucha alegría les comparto que celebraré mis XV años. Los invito a ser parte de este día tan especial.',
	},
	{
		id: 'desc-boda-1',
		label: 'Invitación a boda',
		section: 'description',
		eventTypes: ['boda'],
		text: 'Con gran felicidad les compartimos que uniremos nuestras vidas. Los esperamos para celebrar juntos este momento.',
	},
	{
		id: 'desc-bautizo-1',
		label: 'Invitación a bautizo',
		section: 'description',
		eventTypes: ['bautizo'],
		text: 'Con infinito amor les compartimos el bautizo de nuestro bebé. Los invitamos a acompañarnos en este día de fe.',
	},
	{
		id: 'desc-cumple-1',
		label: 'Invitación a cumpleaños',
		section: 'description',
		eventTypes: ['cumple'],
		text: 'Los invitamos a celebrar un año más de vida. Será un honor contar con su presencia.',
	},

	// Family messages
	{
		id: 'family-boda-1',
		label: 'Con bendición de padres',
		section: 'familyMessage',
		eventTypes: ['boda'],
		text: 'Con la bendición de nuestros padres y el cariño de nuestra familia',
	},
	{
		id: 'family-bautizo-1',
		label: 'Alegría de ser padrinos',
		section: 'familyMessage',
		eventTypes: ['bautizo'],
		text: 'Con la alegría de ser sus padrinos',
	},

	// Thank-you messages
	{
		id: 'thanks-1',
		label: 'Gracias por tu presencia',
		section: 'thankYou',
		text: 'Gracias por ser parte de este día tan especial. Su presencia es el mejor regalo.',
	},
	{
		id: 'thanks-2',
		label: 'Agradecimiento breve',
		section: 'thankYou',
		text: 'Gracias por acompañarnos en este día inolvidable.',
	},

	// Dress code
	{
		id: 'dress-formal',
		label: 'Formal',
		section: 'dressCode',
		text: 'Formal',
	},
	{
		id: 'dress-etiqeta',
		label: 'Etiqueta',
		section: 'dressCode',
		text: 'Etiqueta',
	},
	{
		id: 'dress-casual',
		label: 'Casual',
		section: 'dressCode',
		text: 'Casual',
	},
	{
		id: 'dress-color',
		label: 'Color del evento',
		section: 'dressCode',
		text: 'El color del evento es [color]. Te invitamos a vestir acorde.',
	},

	// Gifts
	{
		id: 'gifts-1',
		label: 'Tu presencia es el mejor regalo',
		section: 'gifts',
		text: 'Tu presencia es el mejor regalo, pero si deseas contribuir, aquí tienes nuestras opciones.',
	},
	{
		id: 'gifts-2',
		label: 'Mesa de regalos general',
		section: 'gifts',
		text: 'Si deseas honrarnos con un regalo, hemos preparado algunas opciones para ti.',
	},

	// RSVP
	{
		id: 'rsvp-title-1',
		label: 'Título de confirmación',
		section: 'rsvpTitle',
		text: '¿Vienes a celebrar conmigo?',
	},
	{
		id: 'rsvp-title-2',
		label: 'Confirma tu asistencia',
		section: 'rsvpTitle',
		text: 'Confirma tu asistencia',
	},
	{
		id: 'rsvp-message-1',
		label: 'Mensaje de confirmación',
		section: 'rsvpMessage',
		text: 'Confirma tu asistencia antes de la fecha del evento. Te esperamos con alegría.',
	},
];

export function getPresetsForSection(section: PresetSection, eventType?: string): TextPreset[] {
	return TEXT_PRESETS.filter(
		(p) =>
			p.section === section &&
			(!p.eventTypes || !eventType || p.eventTypes.includes(eventType)),
	);
}
