import type { InvitationStatus } from '@/lib/intake/types';
import type { InvitationValidity } from '@/lib/intake/invitation-validity';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';

export interface InvitationDTO {
	workflow?: import('@/lib/intake/workflow').InvitationWorkflow;
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
	createdBy: string | null;
	published: boolean;
	rsvpEventStatus: string | null;
	rsvpEventId: string | null;
	rsvpSectionHasContent: boolean;
	internalEditUrl: string;
}

export interface InvitationListItemDTO extends InvitationDTO {
	eventDate: string | null;
	eventTimeZone: string;
	validity: InvitationValidity;
}

export interface InvitationListResponse {
	items: InvitationListItemDTO[];
	canReviewManually: boolean;
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
}

export interface InvitationDetailResponse {
	item: InvitationDTO;
	rsvpEvent: RsvpEventDTO | null;
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
		'published' | 'rsvpEventStatus' | 'rsvpEventId' | 'internalEditUrl'
	> & { snapshot: { previewSlug: string } };
	assetLookupSlug?: string;
	content: DraftContent;
	draftUpdatedAt: string | null;
	draftStatus: 'draft' | 'reviewed' | 'approved' | null;
	publication: InvitationEditorPublicationDTO;
	rsvpLink: {
		status: 'linked' | 'unlinked_slug_match' | 'missing';
		eventId: string | null;
	};
	contentSource: 'draft' | 'published' | 'empty' | 'mixed';
	sectionStates: Record<string, 'draft' | 'published' | 'empty'>;
	divergence: {
		state:
			| 'CLEAN'
			| 'DIVERGED'
			| 'RECONCILIATION_REQUIRED'
			| 'SOURCE_UPDATE_REQUIRED'
			| 'DEFERRED';
		targetEnvironment: 'local' | 'preview' | 'production';
		affectedFieldCount: number;
		affectedSections: string[];
		affectedSectionCount: number;
		isReleaseBlocked: boolean;
	};
}

export type InvitationEditorMetadata = Pick<
	InvitationEditorContextDTO['invitation'],
	| 'title'
	| 'slug'
	| 'status'
	| 'clientName'
	| 'clientEmail'
	| 'clientWhatsapp'
	| 'photosReceived'
	| 'createdBy'
>;

export interface AssignOwnerResponse {
	invitation: InvitationEditorContextDTO['invitation'];
}

export interface InvitationEditorSectionSaveResponse {
	section: InvitationEditorSectionKey;
	value: unknown;
	draftUpdatedAt: string;
	publication: InvitationEditorPublicationDTO;
}

export interface InvitationPublicationPreflightDTO {
	changedPaths: string[];
	changedSections: Array<{ path: string; sectionId: string; sectionLabel: string }>;
	draftRevision: string;
	publishedVersion: number | null;
	publicMetadataHash: string;
	projectionHash: string;
}
