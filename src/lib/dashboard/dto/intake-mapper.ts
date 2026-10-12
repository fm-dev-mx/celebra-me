import type { Invitation, InvitationContentDraft } from '@/lib/intake/types';
import type { InvitationDTO, InvitationContentDraftDTO } from '@/lib/dashboard/dto/intake';

export function toInvitationDTO(invitation: Invitation): InvitationDTO {
	return {
		id: invitation.id,
		workflow: invitation.workflow,
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
		createdBy: invitation.createdBy,
		archivedAt: invitation.archivedAt,
		createdAt: invitation.createdAt,
		updatedAt: invitation.updatedAt,
		published: false,
		rsvpEventStatus: null,
		rsvpEventId: null,
		rsvpSectionHasContent: false,
		internalEditUrl: `/dashboard/invitaciones/${invitation.id}/editar`,
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
