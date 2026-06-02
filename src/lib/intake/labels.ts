import type {
	InvitationStatus,
	IntakeSubmissionStatus,
	IntakeRequestStatus,
	IntakeBlockType,
} from '@/lib/intake/types';
import type { ItineraryIconKey } from '@/lib/theme/theme-contract';

export const SECTION_LABELS: Record<string, string> = {
	Hero: 'Datos principales / Hero',
	countdown: 'Cuenta regresiva',
	family: 'Familia',
	gallery: 'Galería',
	itinerary: 'Itinerario',
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

export const HERO_FIELD_LABELS: Record<string, string> = {
	name: 'Nombre del festejado',
	secondaryName: 'Segundo nombre',
	label: 'Título del evento',
	nickname: 'Apodo',
	date: 'Fecha del evento',
};

export const FAMILY_FIELD_LABELS: Record<string, string> = {
	fatherName: 'Nombre del padre',
	fatherDeceased: 'Padre fallecido',
	motherName: 'Nombre de la madre',
	motherDeceased: 'Madre fallecida',
	spouseName: 'Nombre del cónyuge',
	godparents: 'Padrinos',
	children: 'Hijos',
	sectionMessage: 'Mensaje familiar',
};

export const RSVP_FIELD_LABELS: Record<string, string> = {
	title: 'Título',
	guestCap: 'Acompañantes máximo',
	confirmationMessage: 'Mensaje de confirmación',
	confirmationMode: 'Modo de confirmación',
	whatsappPhone: 'WhatsApp',
	subcopy: 'Texto adicional',
};

export const MUSIC_FIELD_LABELS: Record<string, string> = {
	url: 'URL de la canción',
	title: 'Título de la canción',
};

export const QUOTE_FIELD_LABELS: Record<string, string> = {
	text: 'Frase de apertura',
	author: 'Autor',
};

export const THANK_YOU_FIELD_LABELS: Record<string, string> = {
	message: 'Mensaje de agradecimiento',
	closingName: 'Nombre de despedida',
};

export const VENUE_LABELS: Record<string, string> = {
	venueName: 'Nombre del lugar',
	address: 'Dirección',
	city: 'Ciudad',
	date: 'Fecha',
	time: 'Hora',
	mapUrl: 'Enlace de Google Maps',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
	draft: 'Borrador',
	waiting_for_client: 'Esperando cliente',
	client_submitted: 'Captura recibida',
	in_review: 'En revisión',
	in_production: 'En producción',
	preview_sent: 'Vista previa enviada',
	approved: 'Aprobada',
	published: 'Publicada',
	archived: 'Archivada',
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

export const CAPTURE_LINK_STATUS_LABELS: Record<string, string> = {
	active: 'Activo',
	expired: 'Expirado',
	missing: 'Sin enlace',
	revoked: 'Revocado',
	unavailable: 'No recuperable',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
};

export const RSVP_EVENT_STATUS_LABELS: Record<string, string> = {
	published: 'Activo',
	archived: 'Desactivado',
	draft: 'Borrador',
};

export const RSVP_STATUS_LABELS: Record<string, string> = {
	published: 'RSVP activo',
	archived: 'RSVP desactivado',
	draft: 'RSVP borrador',
};

export const ITINERARY_ICON_LABELS: Record<ItineraryIconKey, string> = {
	waltz: 'Vals',
	dinner: 'Cena',
	toast: 'Brindis',
	cake: 'Pastel',
	party: 'Fiesta',
	church: 'Iglesia',
	map: 'Ubicación',
	reception: 'Recepción',
	photo: 'Fotografía',
	sparkles: 'Destacado',
	boot: 'Bota',
	heel: 'Tacón',
	'western-hat': 'Sombrero',
	taco: 'Tacos',
	tuba: 'Tuba',
	accordion: 'Acordeón',
};

export const GIFT_TYPE_LABELS: Record<string, string> = {
	store: 'Tienda',
	bank: 'Transferencia bancaria',
	paypal: 'PayPal',
	cash: 'Efectivo',
};

export const EDITOR_SECTION_PRESENTATION: Record<string, { id: string; label: string }> = {
	title: { id: 'main', label: 'Datos principales' },
	description: { id: 'main', label: 'Datos principales' },
	hero: { id: 'main', label: 'Datos principales' },
	family: { id: 'family', label: 'Personas principales' },
	location: { id: 'location', label: 'Fecha y ubicaciones' },
	itinerary: { id: 'itinerary', label: 'Programa' },
	rsvp: { id: 'rsvp', label: 'Confirmación de asistencia' },
	music: { id: 'music', label: 'Música' },
	gifts: { id: 'gifts', label: 'Mesa de regalos' },
	quote: { id: 'messages', label: 'Mensajes especiales' },
	thankYou: { id: 'messages', label: 'Mensajes especiales' },
	gallery: { id: 'gallery', label: 'Galería' },
	photoNotes: { id: 'gallery', label: 'Galería' },
	sectionOrder: { id: 'publication', label: 'Publicación' },
};

export const NAV_ITEMS: Array<{ id: string; label: string }> = [
	{ id: 'metadata', label: 'Datos de la invitación' },
	{ id: 'main', label: 'Datos principales' },
	{ id: 'family', label: 'Personas principales' },
	{ id: 'location', label: 'Fecha y ubicaciones' },
	{ id: 'itinerary', label: 'Programa' },
	{ id: 'rsvp', label: 'Confirmación de asistencia' },
	{ id: 'music', label: 'Música' },
	{ id: 'gifts', label: 'Mesa de regalos' },
	{ id: 'messages', label: 'Mensajes especiales' },
	{ id: 'gallery', label: 'Galería' },
	{ id: 'publication', label: 'Publicación' },
];

type FieldGroup = 'hero' | 'family';
type EventType = 'xv' | 'boda' | 'bautizo' | 'cumple';

const EVENT_HERO_LABELS: Record<string, Partial<Record<EventType, string>>> = {
	name: {
		xv: 'Quinceañera',
		boda: 'Novia',
		bautizo: 'Nombre del bebé',
		cumple: 'Nombre del festejado',
	},
	secondaryName: {
		boda: 'Novio',
	},
};

const EVENT_FAMILY_LABELS: Record<string, Partial<Record<EventType, string>>> = {
	spouseName: {
		boda: 'Cónyuge',
	},
};

export function getFieldLabel(group: FieldGroup, field: string, eventType?: string): string {
	const eventLabels = group === 'hero' ? EVENT_HERO_LABELS : EVENT_FAMILY_LABELS;
	const override = eventLabels[field]?.[eventType as EventType];
	if (override) return override;

	const defaults = group === 'hero' ? HERO_FIELD_LABELS : FAMILY_FIELD_LABELS;
	return defaults[field] ?? field;
}
