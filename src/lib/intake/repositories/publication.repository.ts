import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationContentDraft } from '@/lib/intake/types';

export interface AtomicPublicationResult {
	draft: InvitationContentDraft;
	publishedContent: {
		id: string;
		slug: string;
		eventType: string;
		version: number;
		publishedAt: string;
	};
}

const PUBLICATION_ERRORS: Record<
	string,
	{ status: number; code: 'not_found' | 'conflict' | 'invalid_draft_status'; message: string }
> = {
	publish_invitation_not_found: {
		status: 404,
		code: 'not_found',
		message: 'No se encontró la invitación.',
	},
	publish_draft_not_found: {
		status: 404,
		code: 'not_found',
		message: 'No se encontró el borrador que se intentó publicar.',
	},
	publish_invalid_draft_status: {
		status: 409,
		code: 'invalid_draft_status',
		message: 'El borrador ya fue publicado o dejó de estar disponible.',
	},
	publish_stale_draft: {
		status: 409,
		code: 'conflict',
		message:
			'El borrador cambió mientras se publicaba. Recarga la página e inténtalo de nuevo.',
	},
	publish_slug_conflict: {
		status: 409,
		code: 'conflict',
		message: 'El slug ya está en uso por otra invitación. Elige uno diferente.',
	},
	publish_event_slug_conflict: {
		status: 409,
		code: 'conflict',
		message: 'El slug ya está asociado a otro evento. Elige uno diferente.',
	},
	publish_event_type_conflict: {
		status: 409,
		code: 'conflict',
		message: 'El evento RSVP asociado tiene un tipo de evento diferente.',
	},
	publish_event_type_mismatch: {
		status: 409,
		code: 'conflict',
		message: 'El tipo de evento cambió mientras se publicaba. Recarga la página.',
	},
	publish_owner_required: {
		status: 409,
		code: 'conflict',
		message: 'La invitación necesita un propietario antes de publicarse.',
	},
};

export async function commitAtomicPublication(input: {
	invitationId: string;
	draftId: string;
	expectedDraftUpdatedAt: string;
	slug: string;
	eventType: string;
	isDemo: boolean;
	content: Record<string, unknown>;
}): Promise<AtomicPublicationResult> {
	try {
		return await supabaseRestRequest<AtomicPublicationResult>({
			pathWithQuery: 'rpc/publish_invitation_atomic',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_invitation_id: input.invitationId,
				p_draft_id: input.draftId,
				p_expected_draft_updated_at: input.expectedDraftUpdatedAt,
				p_slug: input.slug,
				p_event_type: input.eventType,
				p_is_demo: input.isDemo,
				p_content: input.content,
			},
		});
	} catch (error) {
		const raw = error instanceof Error ? error.message : String(error);
		for (const [marker, mapped] of Object.entries(PUBLICATION_ERRORS)) {
			if (raw.includes(marker)) {
				throw new ApiError(mapped.status, mapped.code, mapped.message, { reason: marker });
			}
		}
		throw error;
	}
}
