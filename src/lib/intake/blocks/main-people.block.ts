import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const mainPeopleBlock: IntakeBlockDefinition = {
	type: 'main-people',
	displayName: 'Personas principales',
	description: 'Padres, padrinos, cónyuge, hijos y personas destacadas del evento.',
	supportedEventTypes: ['xv', 'boda', 'bautizo', 'cumple'],
	fields: [
		{
			name: 'fatherName',
			label: 'Nombre del padre (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Fernando Valenzuela Robles',
		},
		{
			name: 'fatherDeceased',
			label: 'El padre ha fallecido',
			type: 'checkbox',
			required: false,
		},
		{
			name: 'motherName',
			label: 'Nombre de la madre (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: María Elena Duarte',
		},
		{
			name: 'motherDeceased',
			label: 'La madre ha fallecido',
			type: 'checkbox',
			required: false,
		},
		{
			name: 'spouseName',
			label: 'Nombre del cónyuge (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Relevante para bodas',
		},
		{
			name: 'godparents',
			label: 'Padrinos (uno por línea: Nombre — Rol)',
			type: 'textarea',
			required: false,
			placeholder: 'Ej:\nArturo Valenzuela — Padrino\nLucía Duarte — Madrina',
		},
		{
			name: 'children',
			label: 'Hijos (uno por línea: Nombre — Rol)',
			type: 'textarea',
			required: false,
			placeholder: 'Ej:\nSofía — Hija mayor',
		},
		{
			name: 'sectionMessage',
			label: 'Mensaje de la sección familiar (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Un mensaje breve sobre la familia para esta sección.',
		},
	],
};
