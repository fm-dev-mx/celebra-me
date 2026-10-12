import type { ContentSectionKey, EventType, ThemePreset } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-keys';

export type InvitationKind = 'demo' | 'client';

export const INTAKE_BLOCK_TYPES = [
	'event-details',
	'main-people',
	'date-locations',
	'photos',
	'rsvp-config',
	'music',
	'gifts',
	'special-messages',
] as const;

export type IntakeBlockType = (typeof INTAKE_BLOCK_TYPES)[number];

export const INVITATION_STATUSES = [
	'draft',
	'in_production',
	'preview_sent',
	'approved',
	'published',
	'archived',
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface DemoPreset {
	id: string;
	eventType: EventType;
	displayName: string;
	themeId: ThemePreset;
	defaultSections: ContentSectionKey[];
	supportedBlocks: IntakeBlockType[];
	recommendedBlocks: IntakeBlockType[];
	requiredAssets: EventAssetKey[];
	previewSlug: string;
}

export interface Invitation {
	workflow?: import('@/lib/intake/workflow').InvitationWorkflow;
	id: string;
	kind: InvitationKind;
	sourceInvitationId: string | null;
	slug: string | null;
	title: string;
	eventType: EventType;
	status: InvitationStatus;
	baseDemoId: string;
	themeId: string;
	snapshot: DemoPreset;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	createdBy: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export const INVITATION_CONTENT_DRAFT_STATUSES = ['draft', 'reviewed', 'approved'] as const;

export type InvitationContentDraftStatus = (typeof INVITATION_CONTENT_DRAFT_STATUSES)[number];

export type ContentSource = 'draft' | 'published' | 'empty' | 'mixed';

export type SectionSource = 'draft' | 'published' | 'empty';

export interface BundledAssetEntry {
	key: EventAssetKey;
	displayName: string;
	src: string;
	width?: number;
	height?: number;
}

export interface InvitationAsset {
	id: string;
	invitationId: string;
	displayName: string;
	defaultAltText?: string;
	bucket: string;
	storagePath: string;
	mimeType: string;
	width?: number;
	height?: number;
	fileSize?: number;
	validationVersion?: number;
	originalMimeType?: string;
	originalFileSize?: number;
	provider?: 'supabase' | 'cloudinary';
	providerPublicId?: string;
	secureUrl?: string;
	sha256?: string;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

export interface InvitationContentDraft {
	id: string;
	invitationId: string;
	submissionId: string | null;
	content: Record<string, unknown>;
	status: InvitationContentDraftStatus;
	createdAt: string;
	updatedAt: string;
}
