import type { InvitationWorkflow } from '@/lib/intake/workflow';
import type { EventType } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-keys';

type InvitationKind = 'demo' | 'client';

export const INVITATION_STATUSES = [
	'draft',
	'in_production',
	'preview_sent',
	'approved',
	'published',
	'archived',
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface Invitation {
	workflow?: InvitationWorkflow;
	id: string;
	kind: InvitationKind;
	sourceInvitationId: string | null;
	slug: string | null;
	title: string;
	eventType: EventType;
	status: InvitationStatus;
	themeId: string;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	createdBy: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export type InvitationContentDraftStatus = 'draft' | 'reviewed' | 'approved';

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
	provider?: 'supabase' | 'cloudinary' | 'r2';
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
	content: Record<string, unknown>;
	status: InvitationContentDraftStatus;
	createdAt: string;
	updatedAt: string;
}
