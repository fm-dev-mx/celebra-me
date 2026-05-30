import type {
	IntakeBlockType,
	InvitationProjectStatus,
	IntakeRequestStatus,
	IntakeSubmissionStatus,
} from '@/lib/intake/types';
import type { CaptureLinkStatus } from '@/lib/intake/types';

export interface InvitationProjectDTO {
	id: string;
	slug: string | null;
	title: string;
	eventType: string;
	status: InvitationProjectStatus;
	baseDemoId: string;
	themeId: string;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	photosReceived: boolean;
	createdAt: string;
	updatedAt: string;
	hasRequest: boolean;
	hasSubmission: boolean;
	published: boolean;
	rsvpEventStatus: string | null;
	rsvpEventId: string | null;
}

export interface InvitationProjectListResponse {
	items: InvitationProjectDTO[];
}

export interface CreateInvitationProjectDTO {
	title: string;
	slug?: string | null;
	eventType: string;
	baseDemoId: string;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
}

export interface UpdateInvitationProjectDTO {
	title?: string;
	slug?: string | null;
	status?: InvitationProjectStatus;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	photosReceived?: boolean;
}

export interface IntakeRequestDTO {
	id: string;
	invitationProjectId: string;
	status: IntakeRequestStatus;
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

export interface InvitationProjectDetailResponse {
	item: InvitationProjectDTO;
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
	invitationProjectId: string;
	submissionId: string;
	content: Record<string, unknown>;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export interface DraftResponse {
	draft: InvitationContentDraftDTO | null;
}
