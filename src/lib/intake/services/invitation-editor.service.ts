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
import type {
	Invitation,
	InvitationContentDraft,
	ContentSource,
	SectionSource,
} from '@/lib/intake/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findEventByInvitationIdService,
	findEventBySlugService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { loadDemoContent } from '@/lib/intake/editor-api';
import { deepClone, hasRsvpContent } from '@/lib/intake/utils';
import { mapNestedToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { applySectionValue } from '@/lib/intake/services/section-content-mapper';
import {
	applyFieldFallbacks,
	applyVenueImageFallbacks,
} from '@/lib/intake/services/image-fallback';
const ALL_EDITOR_KEYS: ReadonlyArray<keyof DraftContent> = [
	'title',
	'description',
	'hero',
	'family',
	'location',
	'itinerary',
	'rsvp',
	'music',
	'gifts',
	'quote',
	'thankYou',
	'gallery',
	'photoNotes',
	'sectionOrder',
];

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
	invitation: Invitation & { rsvpSectionHasContent: boolean };
	content: DraftContent;
	draftUpdatedAt: string | null;
	draftStatus: InvitationContentDraft['status'] | null;
	publication: PublicationState;
	rsvpLink: RsvpLinkState;
	contentSource: ContentSource;
	sectionStates: Record<string, SectionSource>;
}

function hydrateEditableContent(
	draftContent: Record<string, unknown>,
	publishedContent: Record<string, unknown>,
	demoContent: Record<string, unknown>,
): { content: DraftContent; sectionStates: Record<string, SectionSource> } {
	const draftBase = deepClone(draftContent) as DraftContent;
	const publishedFlat = mapNestedToDraftContent(publishedContent);
	const demoFlat = mapNestedToDraftContent(demoContent);

	const result: DraftContent = {};
	const sectionStates: Record<string, SectionSource> = {};

	for (const key of ALL_EDITOR_KEYS) {
		if (draftBase[key] !== undefined) {
			result[key] = deepClone(draftBase[key]);
			sectionStates[key] = 'draft';
		} else if (publishedFlat[key] !== undefined) {
			result[key] = deepClone(publishedFlat[key]);
			sectionStates[key] = 'published';
		} else if (demoFlat[key] !== undefined) {
			result[key] = deepClone(demoFlat[key]);
			sectionStates[key] = 'demo';
		} else {
			sectionStates[key] = 'empty';
		}
	}

	applyFieldFallbacks(result, publishedFlat, demoFlat, [
		{ section: 'thankYou', field: 'image' },
		{ section: 'hero', field: 'backgroundImage' },
		{ section: 'hero', field: 'portrait' },
	]);

	applyVenueImageFallbacks(result, publishedFlat, demoFlat, ['ceremony', 'reception']);

	return { content: result, sectionStates };
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

function resolveContentSource(sectionStates: Record<string, ContentSource>): ContentSource {
	let result: ContentSource = 'empty';
	for (const state of Object.values(sectionStates)) {
		if (state === 'empty') continue;
		if (result === 'empty') {
			result = state;
		} else if (result !== state) {
			result = 'mixed';
			break;
		}
	}
	return result;
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
	const { content, sectionStates } = hydrateEditableContent(
		draft?.content ?? {},
		published?.content ?? {},
		demoContent,
	);

	const contentSource = resolveContentSource(sectionStates);

	const linkedEvent = await findEventByInvitationIdService(invitationId);
	const slugEvent =
		!linkedEvent && invitation.slug ? await findEventBySlugService(invitation.slug) : null;

	const rsvpSectionHasContent =
		hasRsvpContent(draft?.content as Record<string, unknown> | undefined) ||
		hasRsvpContent(published?.content);

	return {
		invitation: { ...invitation, rsvpSectionHasContent },
		content,
		draftUpdatedAt: draft?.updatedAt ?? null,
		draftStatus: draft?.status ?? null,
		publication: createPublicationState(draft, published),
		rsvpLink: linkedEvent
			? { status: 'linked', eventId: linkedEvent.id }
			: slugEvent
				? { status: 'unlinked_slug_match', eventId: slugEvent.id }
				: { status: 'missing', eventId: null },
		contentSource,
		sectionStates,
	};
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

	const normalizedValue = valueResult.data;

	const [context, currentDraft] = await Promise.all([
		getInvitationEditorContext(invitationId),
		findDraftByInvitationId(invitationId),
	]);
	const nextContent = applySectionValue(context.content, section, normalizedValue);

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

export async function restoreInvitationEditorFromPublished(
	invitationId: string,
	input: { expectedUpdatedAt: string },
) {
	const [draft, published] = await Promise.all([
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);
	if (!published) {
		throw new ApiError(404, 'not_found', 'No existe una versión pública para restaurar.');
	}

	const content = mapNestedToDraftContent(published.content);
	const savedDraft = draft
		? await updateDraftContentConditionally(draft.id, input.expectedUpdatedAt, {
				content,
				status: 'draft',
			})
		: await upsertDraft({ invitationId, submissionId: null, content });

	if (!savedDraft) {
		throw new ApiError(
			409,
			'conflict',
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
		);
	}
	return savedDraft;
}
