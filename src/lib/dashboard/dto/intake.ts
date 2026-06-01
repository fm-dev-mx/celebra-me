import type {
	IntakeBlockType,
	InvitationStatus,
	IntakeRequestStatus,
	IntakeRequestOrigin,
	IntakeSubmissionStatus,
} from '@/lib/intake/types';
import type { CaptureLinkStatus } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

export interface InvitationDTO {
	id: string;
	kind: 'demo' | 'client';
	sourceInvitationId: string | null;
	slug: string | null;
	title: string;
	eventType: string;
	status: InvitationStatus;
	baseDemoId: string;
	themeId: string;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	hasRequest: boolean;
	hasSubmission: boolean;
	published: boolean;
	rsvpEventStatus: string | null;
	rsvpEventId: string | null;
	internalEditUrl: string;
	captureUrl: string | null;
	captureLinkStatus: CaptureLinkStatus | null;
}

export interface InvitationListResponse {
	items: InvitationDTO[];
}

export interface CreateInvitationDTO {
	title: string;
	slug?: string | null;
	eventType: string;
	baseDemoId: string;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
}

export interface UpdateInvitationDTO {
	title?: string;
	slug?: string | null;
	status?: InvitationStatus;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	photosReceived?: boolean;
}

export interface IntakeRequestDTO {
	id: string;
	invitationId: string;
	status: IntakeRequestStatus;
	origin: IntakeRequestOrigin;
	enabledBlocks: IntakeBlockType[];
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	captureUrl: string | null;
	captureLinkStatus: CaptureLinkStatus;
}

export interface IntakeRequestCreateResponse {
	request: IntakeRequestDTO;
	rawToken: string;
}

export interface IntakeSubmissionDTO {
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

export interface RsvpEventDTO {
	id: string;
	slug: string;
	eventType: string;
	title: string;
	status: string;
	guestCount: number;
	confirmedCount: number;
	declinedCount: number;
	pendingCount: number;
	claimCodeCount: number;
}

export interface InvitationDetailResponse {
	item: InvitationDTO;
	request: IntakeRequestDTO | null;
	submission: IntakeSubmissionDTO | null;
	rsvpEvent: RsvpEventDTO | null;
}

export interface ReviewActionDTO {
	action: 'approve' | 'request_changes';
	reviewNotes?: string;
}

export interface CreateIntakeRequestDTO {
	enabledBlocks: IntakeBlockType[];
	expiresInDays?: number;
}

export interface InvitationContentDraftDTO {
	id: string;
	invitationId: string;
	submissionId: string | null;
	content: Record<string, unknown>;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export interface DraftResponse {
	draft: InvitationContentDraftDTO | null;
}

export interface InvitationEditorPublicationDTO {
	hasPublishedContent: boolean;
	version: number | null;
	publishedAt: string | null;
	hasUnpublishedChanges: boolean;
}

export interface InvitationEditorContextDTO {
	invitation: Omit<
		InvitationDTO,
		| 'hasRequest'
		| 'hasSubmission'
		| 'published'
		| 'rsvpEventStatus'
		| 'rsvpEventId'
		| 'internalEditUrl'
		| 'captureUrl'
		| 'captureLinkStatus'
	> & { snapshot: { previewSlug: string } };
	content: DraftContent;
	draftUpdatedAt: string | null;
	draftStatus: 'draft' | 'reviewed' | 'approved' | null;
	publication: InvitationEditorPublicationDTO;
	rsvpLink: {
		status: 'linked' | 'unlinked_slug_match' | 'missing';
		eventId: string | null;
	};
}

export type InvitationEditorMetadata = Pick<
	InvitationEditorContextDTO['invitation'],
	'title' | 'slug' | 'status' | 'clientName' | 'clientEmail' | 'clientWhatsapp' | 'photosReceived'
>;

export interface InvitationEditorSectionSaveResponse {
	section: InvitationEditorSectionKey;
	value: unknown;
	draftUpdatedAt: string;
	publication: InvitationEditorPublicationDTO;
}
