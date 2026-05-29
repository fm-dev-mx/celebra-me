import type {
	InvitationProjectStatus,
	IntakeSubmissionStatus,
	IntakeRequestStatus,
	IntakeBlockType,
} from '@/lib/intake/types';

export const SECTION_LABELS: Record<string, string> = {
	Hero: 'Datos principales / Hero',
	family: 'Familia',
	location: 'Fecha y ubicaciones',
	rsvp: 'Confirmación de asistencia',
	music: 'Música de fondo',
	gifts: 'Regalos',
	quote: 'Mensajes especiales',
	thankYou: 'Agradecimiento',
	photoNotes: 'Notas de fotografías',
};

export const BLOCK_LABELS: Record<IntakeBlockType, string> = {
	'event-details': 'Detalles del evento',
	'main-people': 'Personas principales',
	'date-locations': 'Fecha y ubicaciones',
	photos: 'Fotografías',
	'rsvp-config': 'Confirmación de asistencia',
	music: 'Música de fondo',
	gifts: 'Mesa de regalos',
	'special-messages': 'Mensajes especiales',
};

export const PHOTO_LABELS: Record<string, string> = {
	whatsappSent: 'Fotos enviadas por WhatsApp',
	heroPhoto: 'Foto principal (portada)',
	portraitPhoto: 'Retrato del festejado(a)',
	galleryPhotos: 'Fotos de galería',
	familyPhoto: 'Foto familiar',
	specialPhoto: 'Foto especial',
	generalNotes: 'Notas generales sobre las fotos',
	photoOrder: 'Orden sugerido de las fotos',
	cropNotes: 'Notas de recorte y edición',
	priorityNotes: 'Prioridad de las fotos',
};

export const VENUE_LABELS: Record<string, string> = {
	venueName: 'Nombre del lugar',
	address: 'Dirección',
	city: 'Ciudad',
	date: 'Fecha',
	time: 'Hora',
	mapUrl: 'Enlace de Google Maps',
};

export const PROJECT_STATUS_LABELS: Record<InvitationProjectStatus, string> = {
	draft: 'Borrador',
	waiting_for_client: 'Esperando cliente',
	client_submitted: 'Captura recibida',
	in_review: 'En revisión',
	in_production: 'En producción',
	preview_sent: 'Vista previa enviada',
	approved: 'Aprobado',
	published: 'Publicado',
	archived: 'Archivado',
};

export const SUBMISSION_STATUS_LABELS: Record<IntakeSubmissionStatus, string> = {
	in_progress: 'En progreso',
	submitted: 'Enviada',
	needs_changes: 'Requiere cambios',
	approved: 'Aprobada',
};

export const REQUEST_STATUS_LABELS: Record<IntakeRequestStatus, string> = {
	draft: 'Borrador',
	active: 'Activo',
	submitted: 'Enviado',
	closed: 'Cerrado',
	expired: 'Expirado',
};
