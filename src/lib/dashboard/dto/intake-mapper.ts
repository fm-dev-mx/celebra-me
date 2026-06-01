import type {
	Invitation,
	IntakeRequest,
	IntakeSubmission,
	InvitationContentDraft,
} from '@/lib/intake/types';
import type {
	InvitationDTO,
	IntakeRequestDTO,
	IntakeSubmissionDTO,
	InvitationContentDraftDTO,
} from '@/lib/dashboard/dto/intake';
import { resolveCaptureLink } from '@/lib/intake/services/intake-request.service';

export function toInvitationDTO(invitation: Invitation): InvitationDTO {
	return {
		id: invitation.id,
		kind: invitation.kind,
		sourceInvitationId: invitation.sourceInvitationId,
		slug: invitation.slug,
		title: invitation.title,
		eventType: invitation.eventType,
		status: invitation.status,
		baseDemoId: invitation.baseDemoId,
		themeId: invitation.themeId,
		clientName: invitation.clientName,
		clientEmail: invitation.clientEmail,
		clientWhatsapp: invitation.clientWhatsapp,
		photosReceived: invitation.photosReceived,
		archivedAt: invitation.archivedAt,
		createdAt: invitation.createdAt,
		updatedAt: invitation.updatedAt,
		hasRequest: false,
		hasSubmission: false,
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		rsvpSectionHasContent: false,
		internalEditUrl: `/dashboard/invitaciones/${invitation.id}/editar`,
		captureUrl: null,
		captureLinkStatus: null,
	};
}

export function toIntakeRequestDTO(request: IntakeRequest): IntakeRequestDTO {
	const captureLink = resolveCaptureLink(request);
	return {
		id: request.id,
		invitationId: request.invitationId,
		status: request.status,
		origin: request.origin,
		enabledBlocks: request.enabledBlocks,
		expiresAt: request.expiresAt,
		createdAt: request.createdAt,
		updatedAt: request.updatedAt,
		...captureLink,
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
		invitationId: draft.invitationId,
		submissionId: draft.submissionId,
		content: draft.content,
		status: draft.status,
		createdAt: draft.createdAt,
		updatedAt: draft.updatedAt,
	};
}
