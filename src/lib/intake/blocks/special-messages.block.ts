import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const specialMessagesBlock: IntakeBlockDefinition = {
	type: 'special-messages',
	displayName: 'Mensajes especiales',
	description: 'Frase de apertura, mensaje de agradecimiento y despedida.',
	supportedEventTypes: ['xv', 'boda', 'bautizo', 'cumple'],
	fields: [
		{
			name: 'quoteText',
			label: 'Frase o cita de apertura',
			type: 'textarea',
			required: true,
			placeholder:
				'Ej: Entre rosas y luz de velas, comienza una noche que guardaré para siempre.',
		},
		{
			name: 'quoteAuthor',
			label: 'Autor de la frase (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Isabella Rose',
		},
		{
			name: 'thankYouMessage',
			label: 'Mensaje de agradecimiento',
			type: 'textarea',
			required: true,
			placeholder:
				'Ej: Gracias por compartir esta noche conmigo. Su presencia hace que mis XV años florezcan.',
		},
		{
			name: 'thankYouClosingName',
			label: 'Nombre de despedida',
			type: 'text',
			required: true,
			placeholder: 'Ej: Isabella Rose Valenzuela',
		},
	],
};
