import type {
	InvitationProject,
	IntakeRequest,
	IntakeSubmission,
	InvitationContentDraft,
} from '@/lib/intake/types';
import type {
	InvitationProjectDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	InvitationContentDraftDTO,
} from '@/lib/dashboard/dto/intake';

export function toInvitationProjectDTO(project: InvitationProject): InvitationProjectDTO {
	return {
		id: project.id,
		slug: project.slug,
		title: project.title,
		eventType: project.eventType,
		status: project.status,
		baseDemoId: project.baseDemoId,
		themeId: project.themeId,
		clientName: project.clientName,
		clientEmail: project.clientEmail,
		clientWhatsapp: project.clientWhatsapp,
		photosReceived: project.photosReceived,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
	};
}

export function toIntakeRequestDTO(request: IntakeRequest): IntakeRequestDTO {
	return {
		id: request.id,
		invitationProjectId: request.invitationProjectId,
		status: request.status,
		enabledBlocks: request.enabledBlocks,
		expiresAt: request.expiresAt,
		createdAt: request.createdAt,
		updatedAt: request.updatedAt,
	};
}

export function toIntakeSubmissionDTO(submission: IntakeSubmission): IntakeSubmissionDTO {
	return {
		id: submission.id,
		intakeRequestId: submission.intakeRequestId,
		status: submission.status,
		blockData: submission.blockData,
		photoNotes: submission.photoNotes,
		clientComments: submission.clientComments,
		submittedAt: submission.submittedAt,
		reviewedAt: submission.reviewedAt,
		reviewNotes: submission.reviewNotes,
		createdAt: submission.createdAt,
		updatedAt: submission.updatedAt,
	};
}

export function toInvitationContentDraftDTO(
	draft: InvitationContentDraft,
): InvitationContentDraftDTO {
	return {
		id: draft.id,
		invitationProjectId: draft.invitationProjectId,
		submissionId: draft.submissionId,
		content: draft.content,
		status: draft.status,
		createdAt: draft.createdAt,
		updatedAt: draft.updatedAt,
	};
}
