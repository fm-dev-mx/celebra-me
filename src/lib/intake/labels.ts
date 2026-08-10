import type { EventType } from '@/lib/theme/theme-contract';
import {
	EDITOR_SECTION_PRESENTATION,
	PUBLIC_SECTION_DEFINITIONS,
	CONFIG_SECTION_DEFINITIONS,
} from '@/lib/intake/invitation-section-registry';
import type {
	InvitationStatus,
	IntakeSubmissionStatus,
	IntakeRequestStatus,
	IntakeBlockType,
} from '@/lib/intake/types';
import { isXareniAssetSlug } from '@/lib/assets/asset-keys';
import type { EnvelopeSealColor } from '@/lib/invitation/reveal-card';

export { EDITOR_SECTION_PRESENTATION };

export const ENVELOPE_SEAL_COLOR_LABELS: Record<EnvelopeSealColor, string> = {
	roseGold: 'Oro rosado',
	champagne: 'Champagne',
	blush: 'Rosa blush',
	mauve: 'Malva',
	deepMauve: 'Malva profundo',
};

/** Editor capability retained for the legacy Xareni envelope option. */
export function supportsXareniPresentationOptions(context: { assetLookupSlug?: string }): boolean {
	return isXareniAssetSlug(context.assetLookupSlug);
}

export const SECTION_LABELS: Record<string, string> = {
	Hero: 'Datos principales / Hero',
	countdown: PUBLIC_SECTION_DEFINITIONS.countdown.label,
	family: PUBLIC_SECTION_DEFINITIONS.family.label,
	gallery: PUBLIC_SECTION_DEFINITIONS.gallery.label,
	itinerary: PUBLIC_SECTION_DEFINITIONS.itinerary.label,
	location: PUBLIC_SECTION_DEFINITIONS.location.label,
	rsvp: PUBLIC_SECTION_DEFINITIONS.rsvp.label,
	music: CONFIG_SECTION_DEFINITIONS.music.label,
	gifts: PUBLIC_SECTION_DEFINITIONS.gifts.label,
	quote: PUBLIC_SECTION_DEFINITIONS.quote.label,
	thankYou: PUBLIC_SECTION_DEFINITIONS.thankYou.label,
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
	sectionSubtitle: 'Encabezado de sección',
	sectionTitle: 'Título de sección',
	parentsTitle: 'Título de padres',
	godparentsTitle: 'Título de padrinos',
	spouseTitle: 'Título de cónyuge',
	spouseRole: 'Rol de cónyuge',
	fatherRole: 'Rol del padre',
	motherRole: 'Rol de la madre',
	childrenTitle: 'Título de hijos',
	visible: 'Visibilidad',
};

export const RSVP_FIELD_LABELS: Record<string, string> = {
	title: 'Título',
	guestCap: 'Máximo de asistentes por confirmación',
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
	mapUrl: 'Enlace del mapa',
	googleMapsUrl: 'Google Maps',
	appleMapsUrl: 'Apple Maps',
	wazeUrl: 'Waze',
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

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
	'baby-shower': 'Baby Shower',
	'primera-comunion': 'Primera Comunión',
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

export const GIFT_TYPE_LABELS: Record<string, string> = {
	store: 'Tienda',
	bank: 'Transferencia bancaria',
	paypal: 'PayPal',
	cash: 'Efectivo',
};

type FieldGroup = 'hero' | 'family';

const EVENT_HERO_LABELS: Record<string, Partial<Record<EventType, string>>> = {
	name: {
		xv: 'Quinceañera',
		boda: 'Novia',
		bautizo: 'Nombre del bebé',
		cumple: 'Nombre del festejado',
		'baby-shower': 'Nombre del bebé',
		'primera-comunion': 'Nombre del niño(a)',
	},
	secondaryName: {
		boda: 'Novio',
		'primera-comunion': 'Nombre del segundo niño(a)',
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

export function getAssetUsageLabel(usedInDraft: boolean, usedInPublished: boolean): string {
	if (usedInDraft && usedInPublished) return 'Borrador y publicación';
	if (usedInDraft) return 'Borrador';
	if (usedInPublished) return 'Publicación';
	return 'No utilizado';
}

export const EMPTY_ASSET_LIBRARY_COPY = {
	heading: 'Aún no hay imágenes en esta biblioteca.',
	subtext: 'Sube una imagen para usarla en la invitación.',
} as const;

export const DEMO_ASSET_LABEL = 'Imagen de demo';
export const ASSET_USAGE_LABEL = 'Usada en:';
export const ASSET_EDIT_LABEL = 'Editar nombre';
export const ASSET_SAVE_LABEL = 'Guardar';
export const ASSET_CANCEL_LABEL = 'Cancelar';
export const ASSET_ALT_TEXT_LABEL = 'Texto alternativo';
export const ASSET_ALT_SAVE_LABEL = 'Guardar texto alternativo';
export const ASSET_NO_USAGE_LABEL = 'No utilizada';
export const ASSET_SECTION_REFS_HEADER = 'Usos de esta imagen';

export const ARCHIVED_TAB_LABEL = 'Archivadas';
export const ACTIVE_TAB_LABEL = 'Activas';
export const RESTORE_LABEL = 'Restaurar';
export const ARCHIVED_DATE_LABEL = 'Imagen archivada';
export const ARCHIVED_HELP_LABEL = 'Las imágenes archivadas pueden restaurarse.';
export const ARCHIVE_BLOCKED_LABEL = 'No puedes archivar una imagen que está en uso.';
