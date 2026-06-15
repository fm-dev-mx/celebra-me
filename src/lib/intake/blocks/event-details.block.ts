import type { IntakeBlockDefinition } from '@/lib/intake/types';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';

export const eventDetailsBlock: IntakeBlockDefinition = {
	type: 'event-details',
	displayName: 'Detalles del evento',
	description: 'Nombre del festejado, título del evento, fecha y descripción general.',
	supportedEventTypes: [...EVENT_TYPES],
	fields: [
		{
			name: 'celebrantName',
			label: 'Nombre del festejado(a)',
			type: 'text',
			required: true,
			placeholder: 'Ej: Isabella Rose Valenzuela',
		},
		{
			name: 'secondaryName',
			label: 'Segundo nombre (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Alejandro (para bodas)',
			supportedEventTypes: ['boda'],
		},
		{
			name: 'eventLabel',
			label: 'Título del evento',
			type: 'text',
			required: true,
			placeholder: 'Ej: Mis XV Años, ¡Nos Casamos!, Bautismo',
		},
		{
			name: 'eventDate',
			label: 'Fecha del evento',
			type: 'date',
			required: true,
		},
		{
			name: 'eventTitle',
			label: 'Título de la invitación',
			type: 'text',
			required: true,
			placeholder: 'Ej: XV Años — Isabella Rose',
		},
		{
			name: 'description',
			label: 'Descripción breve (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Una descripción corta del evento para compartir en redes sociales.',
		},
		{
			name: 'nickname',
			label: 'Apodo o frase corta (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Una noche en honor a Don Alberto',
		},
	],
};
