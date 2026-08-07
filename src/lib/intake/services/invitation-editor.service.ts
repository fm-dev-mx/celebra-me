import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	findInvitationById,
	findInvitationBySlug,
} from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
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
import { hasRsvpContent } from '@/lib/intake/utils';
import {
	DraftNormalizationError,
	mapNestedToDraftContent,
} from '@/lib/intake/services/draft-content-mapper';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';
import { mergePublishedWithDraft } from '@/lib/intake/services/merge-content.service';
import {
	applyDraftMutation,
	DraftRevisionConflictError,
} from '@/lib/intake/services/draft-mutation.service';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { recordInvitationMutationOutcome } from '@/lib/intake/services/mutation-operation.service';
import {
	restoreInvitationFromPublishedAtomic,
	saveInvitationMetadataAtomic,
} from '@/lib/intake/repositories/editor-atomic.repository';
import { createMutationOutcome } from '@/lib/intake/mutations/outcome';
import {
	EditorEnvironmentMismatchError,
	resolveEditorDivergence,
	type EditorDivergenceDTO,
} from '@/lib/intake/services/editor-divergence.service';

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
	assetLookupSlug: string;
	content: DraftContent;
	currentDraftId: string | null;
	draftUpdatedAt: string | null;
	draftStatus: InvitationContentDraft['status'] | null;
	publication: PublicationState;
	rsvpLink: RsvpLinkState;
	contentSource: ContentSource;
	sectionStates: Record<string, SectionSource>;
	divergence: EditorDivergenceDTO;
}

function hydrateEditableContent(
	draftContent: Record<string, unknown>,
	publishedContent: Record<string, unknown>,
	demoContent: Record<string, unknown>,
	options: { allowDemoFallback?: boolean } = {},
): { content: DraftContent; sectionStates: Record<string, SectionSource> } {
	try {
		return mergePublishedWithDraft(publishedContent, draftContent, {
			allowDemoFallback: options.allowDemoFallback,
			demoContent,
		});
	} catch (error) {
		if (error instanceof DraftNormalizationError) {
			throw new ApiError(
				422,
				'bad_request',
				'El borrador guardado conserva datos que el editor no puede representar. Ejecuta la canonicalización del borrador antes de editarlo.',
				{ issues: error.issues },
			);
		}
		throw error;
	}
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

function resolveEditorDivergenceOrThrow(slug: string | null): EditorDivergenceDTO {
	try {
		return resolveEditorDivergence({ slug });
	} catch (error) {
		if (error instanceof EditorEnvironmentMismatchError) {
			throw new ApiError(409, 'unsafe_target', error.message);
		}
		throw error;
	}
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
		{ allowDemoFallback: invitation.kind === 'demo' },
	);

	const contentSource = resolveContentSource(sectionStates);
	const assetLookupSlug = resolveAssetSlug(invitation, published?.content, demoContent);

	const linkedEvent = await findEventByInvitationIdService(invitationId);
	const slugEvent =
		!linkedEvent && invitation.slug ? await findEventBySlugService(invitation.slug) : null;

	const rsvpSectionHasContent =
		hasRsvpContent(draft?.content as Record<string, unknown> | undefined) ||
		hasRsvpContent(published?.content);

	const divergence = resolveEditorDivergenceOrThrow(invitation.slug);

	return {
		invitation: { ...invitation, rsvpSectionHasContent },
		assetLookupSlug,
		content,
		currentDraftId: draft?.id ?? null,
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
		divergence,
	};
}

export async function saveInvitationEditorSection(
	invitationId: string,
	section: InvitationEditorSectionKey,
	input: { expectedUpdatedAt: string; value: unknown },
	commandContext?: InvitationMutationCommandContext,
) {
	const published = await findPublishedByInvitationId(invitationId);
	let draftSaved = false;

	try {
		const result = await applyDraftMutation({
			invitationId,
			expectedDraftUpdatedAt: input.expectedUpdatedAt,
			patch: { kind: 'section', section, value: input.value },
			actor: 'editor',
			skipDocumentSchema: true,
		});
		draftSaved = true;

		const mutation = commandContext
			? await recordInvitationMutationOutcome({
					context: commandContext,
					invitationId,
					commandKind: 'save_editor_section',
					status: 'applied',
					completedSteps: ['draft_saved'],
					expectedState: { draftUpdatedAt: input.expectedUpdatedAt },
					result: { section, draftUpdatedAt: result.draftUpdatedAt },
				})
			: undefined;
		return {
			section,
			value: input.value,
			draftUpdatedAt: result.draftUpdatedAt,
			publication: {
				hasPublishedContent: !!published,
				version: published?.version ?? null,
				publishedAt: published?.publishedAt ?? null,
				hasUnpublishedChanges: true,
			},
			...(mutation ? { mutation } : {}),
		};
	} catch (error) {
		if (commandContext && !draftSaved) {
			await recordInvitationMutationOutcome({
				context: commandContext,
				invitationId,
				commandKind: 'save_editor_section',
				status: 'not_applied',
				expectedState: { draftUpdatedAt: input.expectedUpdatedAt },
				error,
			});
		}
		if (commandContext && draftSaved) {
			throw new ApiError(
				503,
				'internal_error',
				'El borrador se guardó, pero no se pudo registrar el resultado de la operación.',
				{ operationId: commandContext.operationId, status: 'partial' },
			);
		}
		if (error instanceof DraftRevisionConflictError) {
			throw new ApiError(
				409,
				'conflict',
				'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
				{ currentDraftUpdatedAt: error.currentDraftUpdatedAt },
			);
		}
		throw error;
	}
}

// eslint-disable-next-line complexity -- Atomic command derives public-change, draft-reopen, and replay response state.
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
	commandContext: InvitationMutationCommandContext,
) {
	const [currentInvitation, draft, published] = await Promise.all([
		findInvitationById(invitationId),
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);
	if (!currentInvitation) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}
	const changesPublicMetadata =
		currentInvitation.title !== input.value.title ||
		currentInvitation.slug !== input.value.slug;
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

	// Title and slug are resolved from the invitation record when publishing.
	// Reopen (or seed) a draft only when either public value actually changed;
	// contact-only metadata must not create a misleading pending-publication state.
	const reopenDraft = Boolean(published && changesPublicMetadata && draft?.status !== 'draft');
	const draftContent = reopenDraft
		? (draft?.content ?? mapNestedToDraftContent(published!.content))
		: null;
	const atomic = await saveInvitationMetadataAtomic({
		invitationId,
		expectedInvitationUpdatedAt: input.expectedUpdatedAt,
		expectedDraftUpdatedAt: reopenDraft ? (draft?.updatedAt ?? null) : null,
		metadata: input.value,
		reopenDraft,
		draftContent,
		context: commandContext,
	});
	const savedInvitation: Invitation = {
		...currentInvitation,
		...input.value,
		updatedAt: atomic.invitationUpdatedAt,
	};
	const publicationDraft: InvitationContentDraft | null = atomic.draftId
		? {
				...(draft ?? {
					id: atomic.draftId,
					invitationId,
					submissionId: null,
					createdAt: atomic.draftUpdatedAt!,
				}),
				id: atomic.draftId,
				content: draftContent ?? draft?.content ?? {},
				status: atomic.draftStatus!,
				updatedAt: atomic.draftUpdatedAt!,
			}
		: null;
	const completedSteps = [
		'invitation_metadata_saved',
		...(reopenDraft ? ['draft_reopened'] : []),
	];
	const mutation = createMutationOutcome({
		operationId: commandContext.operationId,
		status: atomic.idempotent ? 'replayed' : 'applied',
		completedSteps,
		result: { invitationUpdatedAt: atomic.invitationUpdatedAt },
		...(atomic.idempotent
			? { replayedFromOperationId: commandContext.operationId }
			: {}),
	});

	return {
		invitation: savedInvitation,
		draftUpdatedAt: publicationDraft?.updatedAt ?? null,
		draftStatus: publicationDraft?.status ?? null,
		publication: createPublicationState(publicationDraft, published),
		mutation,
	};
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
	input: {
		expectedDraftUpdatedAt: string | null;
		 expectedInvitationUpdatedAt: string;
	},
	commandContext: InvitationMutationCommandContext,
) {
	const [invitation, draft, published] = await Promise.all([
		findInvitationById(invitationId),
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}
	if (!published) {
		throw new ApiError(404, 'not_found', 'No existe una versión pública para restaurar.');
	}
	if (
		invitation.updatedAt !== input.expectedInvitationUpdatedAt ||
		(draft?.updatedAt ?? null) !== input.expectedDraftUpdatedAt
	) {
		throw new ApiError(
			409,
			'conflict',
			'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
		);
	}

	const content = mapNestedToDraftContent(published.content);
	const atomic = await restoreInvitationFromPublishedAtomic({
		invitationId,
		expectedInvitationUpdatedAt: input.expectedInvitationUpdatedAt,
		expectedDraftUpdatedAt: input.expectedDraftUpdatedAt,
		expectedPublishedId: published.id,
		expectedPublishedVersion: published.version,
		draftContent: content,
		context: commandContext,
	});
	return {
		...(draft ?? {
			id: atomic.draftId!,
			invitationId,
			submissionId: null,
			createdAt: atomic.draftUpdatedAt!,
		}),
		id: atomic.draftId!,
		content,
		status: 'draft' as const,
		updatedAt: atomic.draftUpdatedAt!,
		mutation: createMutationOutcome({
			operationId: commandContext.operationId,
			status: atomic.idempotent ? 'replayed' : 'applied',
			completedSteps: ['invitation_metadata_restored', 'draft_restored'],
			...(atomic.idempotent
				? { replayedFromOperationId: commandContext.operationId }
				: {}),
		}),
	};
}
