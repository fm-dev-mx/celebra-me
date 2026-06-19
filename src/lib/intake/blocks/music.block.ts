import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const musicBlock: IntakeBlockDefinition = {
	type: 'music',
	displayName: 'Música',
	description: 'Canción de fondo',
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
