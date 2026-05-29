import type { ContentSectionKey, EventType, ThemePreset } from '@/lib/theme/theme-contract';
import type { EventAssetKey } from '@/lib/assets/asset-registry';

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

export const INVITATION_PROJECT_STATUSES = [
	'draft',
	'waiting_for_client',
	'client_submitted',
	'in_review',
	'in_production',
	'preview_sent',
	'approved',
	'published',
	'archived',
] as const;

export type InvitationProjectStatus = (typeof INVITATION_PROJECT_STATUSES)[number];

export const INTAKE_REQUEST_STATUSES = [
	'draft',
	'active',
	'submitted',
	'closed',
	'expired',
] as const;

export type IntakeRequestStatus = (typeof INTAKE_REQUEST_STATUSES)[number];

export const INTAKE_SUBMISSION_STATUSES = [
	'in_progress',
	'submitted',
	'needs_changes',
	'approved',
] as const;

export type IntakeSubmissionStatus = (typeof INTAKE_SUBMISSION_STATUSES)[number];

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

export interface InvitationProject {
	id: string;
	slug: string | null;
	title: string;
	eventType: EventType;
	status: InvitationProjectStatus;
	baseDemoId: string;
	themeId: string;
	snapshot: DemoPreset;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface IntakeRequest {
	id: string;
	invitationProjectId: string;
	tokenHash: string;
	status: IntakeRequestStatus;
	enabledBlocks: IntakeBlockType[];
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface IntakeSubmission {
	id: string;
	intakeRequestId: string;
	status: IntakeSubmissionStatus;
	blockData: Record<string, unknown>;
	photoNotes: Record<string, unknown>;
	clientComments: string;
	submittedAt: string | null;
	reviewedAt: string | null;
	reviewNotes: string;
	createdAt: string;
	updatedAt: string;
}

export interface IntakeBlockFieldDefinition {
	name: string;
	label: string;
	type: 'text' | 'textarea' | 'date' | 'url' | 'number' | 'checkbox' | 'select';
	required: boolean;
	placeholder?: string;
	options?: Array<{ value: string; label: string }>;
}

export interface IntakeBlockDefinition {
	type: IntakeBlockType;
	displayName: string;
	description: string;
	supportedEventTypes: EventType[];
	fields: IntakeBlockFieldDefinition[];
}

export const INVITATION_CONTENT_DRAFT_STATUSES = ['draft', 'reviewed', 'approved'] as const;

export type InvitationContentDraftStatus = (typeof INVITATION_CONTENT_DRAFT_STATUSES)[number];

export interface InvitationContentDraft {
	id: string;
	invitationProjectId: string;
	submissionId: string;
	content: Record<string, unknown>;
	status: InvitationContentDraftStatus;
	createdAt: string;
	updatedAt: string;
}
