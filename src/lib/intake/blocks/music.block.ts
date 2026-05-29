import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const musicBlock: IntakeBlockDefinition = {
	type: 'music',
	displayName: 'Música de fondo',
	description: 'URL de la canción que sonará al abrir la invitación.',
	supportedEventTypes: ['xv', 'boda', 'bautizo', 'cumple'],
	fields: [
		{
			name: 'url',
			label: 'URL de la música (MP3, enlace directo)',
			type: 'url',
			required: true,
			placeholder: 'Ej: https://res.cloudinary.com/.../cancion.mp3',
		},
		{
			name: 'title',
			label: 'Título de la canción (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Nuvole Bianche — Ludovico Einaudi',
		},
	],
};
