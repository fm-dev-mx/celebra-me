import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';

export interface AtomicEditorMutationResult {
	invitationUpdatedAt: string;
	draftId: string | null;
	draftUpdatedAt: string | null;
	draftStatus: 'draft' | 'reviewed' | 'approved' | null;
	idempotent: boolean;
	publishedId?: string;
	publishedVersion?: number;
}

const EDITOR_ATOMIC_ERRORS: Record<string, { status: number; message: string }> = {
	editor_invitation_not_found: { status: 404, message: 'No se encontró la invitación.' },
	editor_stale_invitation: {
		status: 409,
		message: 'Otra persona guardó cambios en la invitación. Recarga los datos para continuar.',
	},
	editor_stale_draft: {
		status: 409,
		message: 'Otra persona guardó cambios en el borrador. Recarga los datos para continuar.',
	},
	editor_stale_published: {
		status: 409,
		message: 'La versión pública cambió. Recarga los datos para continuar.',
	},
	editor_operation_id_reused: {
		status: 409,
		message: 'Esta operación ya fue usada con otros cambios.',
	},
	editor_slug_conflict: { status: 409, message: 'Este slug ya está en uso.' },
};

function throwAtomicEditorError(error: unknown): never {
	const raw = error instanceof Error ? error.message : String(error);
	for (const [reason, mapped] of Object.entries(EDITOR_ATOMIC_ERRORS)) {
		if (raw.includes(reason)) {
			throw new ApiError(mapped.status, 'conflict', mapped.message, { reason });
		}
	}
	throw error;
}

function contextBody(context: InvitationMutationCommandContext) {
	return {
		p_operation_id: context.operationId,
		p_environment: context.environment,
		p_project_ref: context.projectRef,
		p_actor_id: context.actorId,
		p_actor_type: context.actorType,
		p_origin: context.origin,
	};
}

export async function saveInvitationMetadataAtomic(input: {
	invitationId: string;
	expectedInvitationUpdatedAt: string;
	expectedDraftUpdatedAt: string | null;
	metadata: Record<string, unknown>;
	reopenDraft: boolean;
	draftContent: Record<string, unknown> | null;
	context: InvitationMutationCommandContext;
}): Promise<AtomicEditorMutationResult> {
	try {
		return await supabaseRestRequest<AtomicEditorMutationResult>({
			pathWithQuery: 'rpc/save_invitation_metadata_atomic',
			method: 'POST',
			useServiceRole: true,
			body: {
				...contextBody(input.context),
				p_invitation_id: input.invitationId,
				p_expected_invitation_updated_at: input.expectedInvitationUpdatedAt,
				p_expected_draft_updated_at: input.expectedDraftUpdatedAt,
				p_metadata: input.metadata,
				p_reopen_draft: input.reopenDraft,
				p_draft_content: input.draftContent,
			},
		});
	} catch (error) {
		throwAtomicEditorError(error);
	}
}

export async function restoreInvitationFromPublishedAtomic(input: {
	invitationId: string;
	expectedInvitationUpdatedAt: string;
	expectedDraftUpdatedAt: string | null;
	expectedPublishedId: string;
	expectedPublishedVersion: number;
	draftContent: Record<string, unknown>;
	context: InvitationMutationCommandContext;
}): Promise<AtomicEditorMutationResult> {
	try {
		return await supabaseRestRequest<AtomicEditorMutationResult>({
			pathWithQuery: 'rpc/restore_invitation_from_published_atomic',
			method: 'POST',
			useServiceRole: true,
			body: {
				...contextBody(input.context),
				p_invitation_id: input.invitationId,
				p_expected_invitation_updated_at: input.expectedInvitationUpdatedAt,
				p_expected_draft_updated_at: input.expectedDraftUpdatedAt,
				p_expected_published_id: input.expectedPublishedId,
				p_expected_published_version: input.expectedPublishedVersion,
				p_draft_content: input.draftContent,
			},
		});
	} catch (error) {
		throwAtomicEditorError(error);
	}
}
