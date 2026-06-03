import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';

// ===== Public Section IDs =====

export const PUBLIC_SECTION_IDS = ['hero', ...INVITATION_RENDER_SECTION_KEYS] as const;

export type PublicSectionId = (typeof PUBLIC_SECTION_IDS)[number];

// ===== Types =====

export interface PublicSectionDefinition {
	id: PublicSectionId;
	label: string;
	editorCardId: string | undefined;
	draftContentKeys: string[];
	isRequired: boolean;
	isOrderable: boolean;
	isToggleable: boolean;
	previewAnchor: string;
}

// ===== Public Section Definitions =====

export const PUBLIC_SECTION_DEFINITIONS: Record<PublicSectionId, PublicSectionDefinition> = {
	hero: {
		id: 'hero',
		label: 'Portada',
		editorCardId: 'main',
		draftContentKeys: ['title', 'description', 'hero'],
		isRequired: true,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '#hero',
	},
	quote: {
		id: 'quote',
		label: 'Frase',
		editorCardId: 'messages',
		draftContentKeys: ['quote'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#quote-section',
	},
	countdown: {
		id: 'countdown',
		label: 'Cuenta regresiva',
		editorCardId: undefined,
		draftContentKeys: [],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#countdown',
	},
	location: {
		id: 'location',
		label: 'Fecha y ubicaciones',
		editorCardId: 'location',
		draftContentKeys: ['location'],
		isRequired: true,
		isOrderable: true,
		isToggleable: false,
		previewAnchor: '#event-location',
	},
	family: {
		id: 'family',
		label: 'Familia',
		editorCardId: 'family',
		draftContentKeys: ['family'],
		isRequired: true,
		isOrderable: true,
		isToggleable: false,
		previewAnchor: '#family-section',
	},
	itinerary: {
		id: 'itinerary',
		label: 'Programa',
		editorCardId: 'itinerary',
		draftContentKeys: ['itinerary'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#itinerary',
	},
	gallery: {
		id: 'gallery',
		label: 'Galería',
		editorCardId: 'gallery',
		draftContentKeys: ['gallery'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#galeria',
	},
	rsvp: {
		id: 'rsvp',
		label: 'Confirmación de asistencia',
		editorCardId: 'rsvp',
		draftContentKeys: ['rsvp'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#rsvp',
	},
	gifts: {
		id: 'gifts',
		label: 'Mesa de regalos',
		editorCardId: 'gifts',
		draftContentKeys: ['gifts'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#regalos',
	},
	thankYou: {
		id: 'thankYou',
		label: 'Agradecimiento',
		editorCardId: 'messages',
		draftContentKeys: ['thankYou'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#thank-you-section',
	},
	personalizedAccess: {
		id: 'personalizedAccess',
		label: 'Acceso personalizado',
		editorCardId: undefined,
		draftContentKeys: [],
		isRequired: false,
		isOrderable: false,
		isToggleable: true,
		previewAnchor: '',
	},
};

// ===== Helpers =====

export function getPublicSectionDefinitions(): PublicSectionDefinition[] {
	return PUBLIC_SECTION_IDS.map((id) => PUBLIC_SECTION_DEFINITIONS[id]);
}

export function deriveOrderedPublicSections(sectionOrder?: string[]): PublicSectionDefinition[] {
	const heroDef = PUBLIC_SECTION_DEFINITIONS.hero;
	const order = sectionOrder ?? [];
	const rest = order
		.map((id) => PUBLIC_SECTION_DEFINITIONS[id as PublicSectionId])
		.filter((def): def is PublicSectionDefinition => def !== undefined && def.id !== 'hero');
	return [heroDef, ...rest];
}

// ===== Visibility Status =====

export type SectionVisibilityStatus = 'Requerida' | 'Visible' | 'Oculta' | 'Vacía';

export function getSectionVisibilityStatus(
	sectionId: string,
	sectionOrder: string[],
	hasContent: boolean,
): SectionVisibilityStatus {
	const def = PUBLIC_SECTION_DEFINITIONS[sectionId as PublicSectionId];
	if (!def) return 'Vacía';
	if (def.isRequired) return 'Requerida';
	if (!hasContent) return 'Vacía';
	return sectionOrder.includes(sectionId) ? 'Visible' : 'Oculta';
}

// ===== Sidebar Grouping =====

export const ADMIN_EDITOR_CARD_IDS = ['metadata', 'publication', 'assetLibrary'] as const;
