import type {
	IntakeBlockType,
	InvitationProjectStatus,
	IntakeRequestStatus,
	IntakeSubmissionStatus,
} from '@/lib/intake/types';

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

export interface InvitationProjectDetailResponse {
	item: InvitationProjectDTO;
	request: IntakeRequestDTO | null;
	submission: IntakeSubmissionDTO | null;
}

export interface ReviewActionDTO {
	action: 'approve' | 'request_changes';
	reviewNotes?: string;
}

export interface CreateIntakeRequestDTO {
	enabledBlocks: IntakeBlockType[];
	expiresInDays?: number;
}
