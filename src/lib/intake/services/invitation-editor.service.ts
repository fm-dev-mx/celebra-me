import {
	findDraftByInvitationId,
	updateDraftContentConditionally,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	findInvitationById,
	findInvitationBySlug,
	updateInvitationConditionally,
} from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	InvitationEditorSectionSchemas,
	type InvitationEditorSectionKey,
} from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import type { Invitation, InvitationContentDraft } from '@/lib/intake/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findEventByInvitationIdService,
	findEventBySlugService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { loadDemoContent } from '@/lib/intake/editor-api';
import { deepClone } from '@/lib/intake/utils';

const HYDRATED_DRAFT_KEYS = ['gallery', 'itinerary', 'sectionOrder'] as const;

type PublicationState = {
	hasPublishedContent: boolean;
	version: number | null;
	publishedAt: string | null;
	hasUnpublishedChanges: boolean;
};

type RsvpLinkState = {
	status: 'linked' | 'unlinked_slug_match' | 'missing';
	eventId: string | null;
};

export interface InvitationEditorContext {
	invitation: Invitation;
	content: DraftContent;
	draftUpdatedAt: string | null;
	draftStatus: InvitationContentDraft['status'] | null;
	publication: PublicationState;
	rsvpLink: RsvpLinkState;
}

function hydrateEditableContent(
	draftContent: Record<string, unknown>,
	publishedContent: Record<string, unknown>,
	demoContent: Record<string, unknown>,
): DraftContent {
	const effectiveContent = deepClone(draftContent) as DraftContent;

	for (const key of HYDRATED_DRAFT_KEYS) {
		if (effectiveContent[key] !== undefined) continue;
		const inheritedValue = publishedContent[key] ?? demoContent[key];
		if (inheritedValue !== undefined) {
			(effectiveContent as Record<string, unknown>)[key] = deepClone(inheritedValue);
		}
	}

	return effectiveContent;
}

function createPublicationState(
	draft: InvitationContentDraft | null,
	published: Awaited<ReturnType<typeof findPublishedByInvitationId>>,
): PublicationState {
	return {
		hasPublishedContent: !!published,
		version: published?.version ?? null,
		publishedAt: published?.publishedAt ?? null,
		hasUnpublishedChanges: draft?.status === 'draft',
	};
}

export async function getInvitationEditorContext(
	invitationId: string,
): Promise<InvitationEditorContext> {
	const [invitation, draft, published] = await Promise.all([
		findInvitationById(invitationId),
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);

	if (!invitation) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}

	const demoContent = await loadDemoContent(invitation.snapshot.previewSlug);
	const content = hydrateEditableContent(
		draft?.content ?? {},
		published?.content ?? {},
		demoContent,
	);
	const linkedEvent = await findEventByInvitationIdService(invitationId);
	const slugEvent =
		!linkedEvent && invitation.slug ? await findEventBySlugService(invitation.slug) : null;

	return {
		invitation,
		content,
		draftUpdatedAt: draft?.updatedAt ?? null,
		draftStatus: draft?.status ?? null,
		publication: createPublicationState(draft, published),
		rsvpLink: linkedEvent
			? { status: 'linked', eventId: linkedEvent.id }
			: slugEvent
				? { status: 'unlinked_slug_match', eventId: slugEvent.id }
				: { status: 'missing', eventId: null },
	};
}

function applySectionValue(
	content: DraftContent,
	section: InvitationEditorSectionKey,
	value: unknown,
): DraftContent {
	const next = deepClone(content);

	if (section === 'main') {
		const main = value as Pick<DraftContent, 'title' | 'description' | 'hero'>;
		return { ...next, title: main.title, description: main.description, hero: main.hero };
	}
	if (section === 'messages') {
		const messages = value as Pick<DraftContent, 'quote' | 'thankYou'>;
		return { ...next, quote: messages.quote, thankYou: messages.thankYou };
	}
	if (section === 'publication') {
		const publication = value as Pick<DraftContent, 'sectionOrder'>;
		return { ...next, sectionOrder: publication.sectionOrder };
	}

	return { ...next, [section]: value };
}

export async function saveInvitationEditorSection(
	invitationId: string,
	section: InvitationEditorSectionKey,
	input: { expectedUpdatedAt: string; value: unknown },
) {
	const valueResult = InvitationEditorSectionSchemas[section].safeParse(input.value);
	if (!valueResult.success) {
		throw new ApiError(422, 'bad_request', 'Revisa los campos marcados antes de guardar.', {
			issues: valueResult.error.issues,
		});
	}

	const [context, currentDraft] = await Promise.all([
		getInvitationEditorContext(invitationId),
		findDraftByInvitationId(invitationId),
	]);
	const nextContent = applySectionValue(context.content, section, input.value);

	const savedDraft = currentDraft
		? await updateDraftContentConditionally(currentDraft.id, input.expectedUpdatedAt, {
				content: nextContent,
				status: 'draft',
			})
		: await upsertDraft({
				invitationId,
				submissionId: null,
				content: nextContent,
			});

	if (!savedDraft) {
		throw new ApiError(
			409,
			'conflict',
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
		);
	}

	return {
		section,
		value: input.value,
		draftUpdatedAt: savedDraft.updatedAt,
		publication: {
			...context.publication,
			hasUnpublishedChanges: true,
		},
	};
}

export async function saveInvitationEditorMetadata(
	invitationId: string,
	input: {
		expectedUpdatedAt: string;
		value: {
			title: string;
			slug: string | null;
			status: Invitation['status'];
			clientName: string;
			clientEmail: string;
			clientWhatsapp: string;
			photosReceived: boolean;
		};
	},
) {
	if (input.value.slug) {
		const matchingInvitation = await findInvitationBySlug(input.value.slug);
		if (matchingInvitation && matchingInvitation.id !== invitationId) {
			throw new ApiError(
				409,
				'conflict',
				'Este slug ya está en uso. Elige otro antes de guardar.',
			);
		}
	}

	const savedInvitation = await updateInvitationConditionally(
		invitationId,
		input.expectedUpdatedAt,
		input.value,
	);
	if (!savedInvitation) {
		throw new ApiError(
			409,
			'conflict',
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
		);
	}

	return { invitation: savedInvitation };
}

export async function reconcileInvitationRsvp(invitationId: string) {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	if (!invitation.slug) {
		throw new ApiError(422, 'bad_request', 'Guarda un slug antes de vincular el evento RSVP.');
	}

	const [linkedEvent, slugEvent] = await Promise.all([
		findEventByInvitationIdService(invitationId),
		findEventBySlugService(invitation.slug),
	]);
	if (linkedEvent && slugEvent && linkedEvent.id !== slugEvent.id) {
		throw new ApiError(
			409,
			'conflict',
			'El slug está vinculado a otro evento RSVP. Revisa los datos antes de continuar.',
		);
	}

	const event = linkedEvent ?? slugEvent;
	if (!event) {
		throw new ApiError(
			404,
			'not_found',
			'No se encontró un evento RSVP compatible para vincular.',
		);
	}
	if (event.eventType !== invitation.eventType) {
		throw new ApiError(
			409,
			'conflict',
			'El tipo del evento RSVP no coincide con el tipo de la invitación.',
		);
	}

	const updatedEvent = await updateEventService({
		eventId: event.id,
		invitationId,
		title: invitation.title,
		slug: invitation.slug,
	});
	return { rsvpLink: { status: 'linked' as const, eventId: updatedEvent.id } };
}
