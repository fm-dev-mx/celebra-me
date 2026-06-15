import type { IntakeBlockDefinition } from '@/lib/intake/types';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';

export const rsvpConfigBlock: IntakeBlockDefinition = {
	type: 'rsvp-config',
	displayName: 'Confirmación de asistencia (RSVP)',
	description: 'Configuración de confirmación: título, capacidad de invitados y mensaje.',
	supportedEventTypes: [...EVENT_TYPES],
	fields: [
		{
			name: 'title',
			label: 'Título de la sección de confirmación',
			type: 'text',
			required: true,
			placeholder: 'Ej: ¿Vienes a celebrar conmigo?',
		},
		{
			name: 'guestCap',
			label: 'Número máximo de acompañantes por invitado',
			type: 'number',
			required: true,
			placeholder: 'Ej: 4',
		},
		{
			name: 'confirmationMessage',
			label: 'Mensaje de confirmación',
			type: 'textarea',
			required: true,
			placeholder: 'Ej: Gracias por confirmar. Te esperamos con alegría.',
		},
		{
			name: 'confirmationMode',
			label: 'Modo de confirmación',
			type: 'select',
			required: true,
			options: [
				{ value: 'api', label: 'Solo formulario' },
				{ value: 'whatsapp', label: 'Solo WhatsApp' },
				{ value: 'both', label: 'Formulario y WhatsApp' },
			],
		},
		{
			name: 'whatsappPhone',
			label: 'Número de WhatsApp para confirmaciones (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: 5214421234567 (con código de país)',
		},
		{
			name: 'subcopy',
			label: 'Texto adicional bajo el título (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Instrucciones breves para los invitados.',
		},
	],
};
