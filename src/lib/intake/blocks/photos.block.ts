import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const photosBlock: IntakeBlockDefinition = {
	type: 'photos',
	displayName: 'Fotografías',
	description:
		'Envía tus fotos por WhatsApp como documento (calidad original). Indica aquí el uso previsto para cada foto.',
	fields: [
		{
			name: 'whatsappSent',
			label: 'Ya envié las fotos por WhatsApp',
			type: 'checkbox',
			required: false,
		},
		{
			name: 'heroPhoto',
			label: 'Foto principal (portada)',
			type: 'textarea',
			required: false,
			placeholder:
				'Describe la foto principal o indica "enviada por WhatsApp". Esta foto aparece en la portada de la invitación.',
		},
		{
			name: 'portraitPhoto',
			label: 'Retrato del festejado(a)',
			type: 'textarea',
			required: false,
			placeholder:
				'Describe el retrato o indica "enviado por WhatsApp". Se usa en la sección de apertura o despedida.',
		},
		{
			name: 'galleryPhotos',
			label: 'Fotos de galería (mínimo 3, máximo 15)',
			type: 'textarea',
			required: false,
			placeholder:
				'Describe las fotos para la galería, una por línea.\nEj:\n1. Sesión en el jardín\n2. Detalle del vestido\n3. Foto con mis padres',
		},
		{
			name: 'familyPhoto',
			label: 'Foto familiar (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Describe la foto familiar o indica "enviada por WhatsApp".',
		},
		{
			name: 'specialPhoto',
			label: 'Foto especial para sección adicional (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Alguna foto adicional para interludios o secciones especiales.',
		},
		{
			name: 'generalNotes',
			label: 'Notas generales sobre las fotos',
			type: 'textarea',
			required: false,
			placeholder:
				'Indicaciones adicionales sobre calidad, estilo, filtros, o cualquier preferencia.',
		},
		{
			name: 'photoOrder',
			label: 'Orden sugerido de las fotos',
			type: 'textarea',
			required: false,
			placeholder:
				'Describe el orden en que deben aparecer las fotos (por nombre o descripción). Ej: 1. Retrato principal, 2. Foto con padres, 3. Foto grupal.',
		},
		{
			name: 'cropNotes',
			label: 'Notas de recorte y edición',
			type: 'textarea',
			required: false,
			placeholder:
				'Indica si alguna foto necesita recorte, ajuste de color, o cualquier edición específica.',
		},
		{
			name: 'priorityNotes',
			label: 'Prioridad de las fotos',
			type: 'textarea',
			required: false,
			placeholder:
				'Indica qué fotos son prioritarias o deben destacarse. Ej: La foto familiar es la más importante.',
		},
	],
};
