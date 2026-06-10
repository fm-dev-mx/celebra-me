import {
	INVITATION_RENDER_SECTION_KEYS,
	type InvitationRenderSectionKey,
} from '@/lib/theme/theme-contract';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

// ===== Public Section IDs =====

export const PUBLIC_SECTION_IDS = ['hero', ...INVITATION_RENDER_SECTION_KEYS] as const;

export type PublicSectionId = (typeof PUBLIC_SECTION_IDS)[number];
export type EditorSidebarGroup = 'public' | 'config';
export type EditorSectionId =
	| PublicSectionId
	| 'metadata'
	| 'music'
	| 'envelope'
	| 'publication'
	| 'assetLibrary'
	| 'sharing';

// ===== Types =====

export interface EditorSectionDefinition {
	id: EditorSectionId;
	label: string;
	sidebarGroup: EditorSidebarGroup;
	editorCardId: string | undefined;
	saveSectionKey: InvitationEditorSectionKey | 'metadata' | undefined;
	draftContentKeys: string[];
	isRequired: boolean;
	isOrderable: boolean;
	isToggleable: boolean;
	previewAnchor: string;
}

// ===== Public Section Definitions =====

export const PUBLIC_SECTION_DEFINITIONS: Record<PublicSectionId, EditorSectionDefinition> = {
	hero: {
		id: 'hero',
		label: 'Portada',
		sidebarGroup: 'public',
		editorCardId: 'main',
		saveSectionKey: 'main',
		draftContentKeys: ['title', 'description', 'hero'],
		isRequired: true,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '#hero',
	},
	quote: {
		id: 'quote',
		label: 'Frase',
		sidebarGroup: 'public',
		editorCardId: 'quote',
		saveSectionKey: 'messages',
		draftContentKeys: ['quote'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#quote-section',
	},
	family: {
		id: 'family',
		label: 'Familia',
		sidebarGroup: 'public',
		editorCardId: 'family',
		saveSectionKey: 'family',
		draftContentKeys: ['family'],
		isRequired: true,
		isOrderable: true,
		isToggleable: false,
		previewAnchor: '#family-section',
	},
	gallery: {
		id: 'gallery',
		label: 'Galería',
		sidebarGroup: 'public',
		editorCardId: 'gallery',
		saveSectionKey: 'gallery',
		draftContentKeys: ['gallery'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#galeria',
	},
	countdown: {
		id: 'countdown',
		label: 'Cuenta regresiva',
		sidebarGroup: 'public',
		editorCardId: 'countdown',
		saveSectionKey: 'countdown',
		draftContentKeys: ['countdown'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#countdown',
	},
	location: {
		id: 'location',
		label: 'Fecha y ubicaciones',
		sidebarGroup: 'public',
		editorCardId: 'location',
		saveSectionKey: 'location',
		draftContentKeys: ['location'],
		isRequired: true,
		isOrderable: true,
		isToggleable: false,
		previewAnchor: '#event-location',
	},
	itinerary: {
		id: 'itinerary',
		label: 'Programa',
		sidebarGroup: 'public',
		editorCardId: 'itinerary',
		saveSectionKey: 'itinerary',
		draftContentKeys: ['itinerary'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#itinerary',
	},
	rsvp: {
		id: 'rsvp',
		label: 'Confirmación de asistencia',
		sidebarGroup: 'public',
		editorCardId: 'rsvp',
		saveSectionKey: 'rsvp',
		draftContentKeys: ['rsvp'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#rsvp',
	},
	gifts: {
		id: 'gifts',
		label: 'Mesa de regalos',
		sidebarGroup: 'public',
		editorCardId: 'gifts',
		saveSectionKey: 'gifts',
		draftContentKeys: ['gifts'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#regalos',
	},
	thankYou: {
		id: 'thankYou',
		label: 'Agradecimiento',
		sidebarGroup: 'public',
		editorCardId: 'thankYou',
		saveSectionKey: 'messages',
		draftContentKeys: ['thankYou'],
		isRequired: false,
		isOrderable: true,
		isToggleable: true,
		previewAnchor: '#thank-you-section',
	},
	personalizedAccess: {
		id: 'personalizedAccess',
		label: 'Acceso personalizado',
		sidebarGroup: 'config',
		editorCardId: 'personalizedAccess',
		saveSectionKey: undefined,
		draftContentKeys: [],
		isRequired: false,
		isOrderable: false,
		isToggleable: true,
		previewAnchor: '',
	},
};

export const CONFIG_SECTION_DEFINITIONS: Record<
	Exclude<EditorSectionId, PublicSectionId>,
	EditorSectionDefinition
> = {
	metadata: {
		id: 'metadata',
		label: 'Datos de la invitación',
		sidebarGroup: 'config',
		editorCardId: 'metadata',
		saveSectionKey: 'metadata',
		draftContentKeys: [],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
	music: {
		id: 'music',
		label: 'Música',
		sidebarGroup: 'config',
		editorCardId: 'music',
		saveSectionKey: 'music',
		draftContentKeys: ['music'],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
	envelope: {
		id: 'envelope',
		label: 'Sobre / apertura',
		sidebarGroup: 'config',
		editorCardId: 'envelope',
		saveSectionKey: 'envelope',
		draftContentKeys: ['envelope'],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
	publication: {
		id: 'publication',
		label: 'Publicación',
		sidebarGroup: 'config',
		editorCardId: 'publication',
		saveSectionKey: 'publication',
		draftContentKeys: ['sectionOrder'],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
	assetLibrary: {
		id: 'assetLibrary',
		label: 'Biblioteca de imágenes',
		sidebarGroup: 'config',
		editorCardId: 'assetLibrary',
		saveSectionKey: undefined,
		draftContentKeys: [],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
	sharing: {
		id: 'sharing',
		label: 'Plantillas de mensaje',
		sidebarGroup: 'config',
		editorCardId: 'sharing',
		saveSectionKey: 'sharing',
		draftContentKeys: ['sharing'],
		isRequired: false,
		isOrderable: false,
		isToggleable: false,
		previewAnchor: '',
	},
};

const CONFIG_SECTION_ORDER = [
	'metadata',
	'publication',
	'sharing',
	'assetLibrary',
	'music',
	'envelope',
] as const;

// ===== Helpers =====

export function getPublicSectionDefinitions(): EditorSectionDefinition[] {
	return PUBLIC_SECTION_IDS.map((id) => PUBLIC_SECTION_DEFINITIONS[id]);
}

export function getConfigEditorSections(options?: {
	includePersonalizedAccess?: boolean;
}): EditorSectionDefinition[] {
	const sections = CONFIG_SECTION_ORDER.map((id) => CONFIG_SECTION_DEFINITIONS[id]);
	if (options?.includePersonalizedAccess) {
		sections.push(PUBLIC_SECTION_DEFINITIONS.personalizedAccess);
	}
	return sections;
}

export function getEditorSectionById(sectionId: string): EditorSectionDefinition | undefined {
	return (
		PUBLIC_SECTION_DEFINITIONS[sectionId as PublicSectionId] ??
		CONFIG_SECTION_DEFINITIONS[sectionId as Exclude<EditorSectionId, PublicSectionId>]
	);
}

export function getPreviewAnchorForSection(sectionId: string): string {
	return getEditorSectionById(sectionId)?.previewAnchor ?? '';
}

export function deriveOrderedPublicSections(sectionOrder?: string[]): EditorSectionDefinition[] {
	const heroDef = PUBLIC_SECTION_DEFINITIONS.hero;
	const order = sectionOrder ?? [];
	const rest = order
		.map((id) => PUBLIC_SECTION_DEFINITIONS[id as InvitationRenderSectionKey])
		.filter(
			(def): def is EditorSectionDefinition =>
				def !== undefined && def.sidebarGroup === 'public' && def.id !== 'hero',
		);
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
