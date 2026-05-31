import { getCollection } from 'astro:content';
import {
	findDraftByInvitationId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	upsertPublishedContent,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findInvitationById,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	findEventByInvitationIdService,
	findEventBySlugService,
	createEventService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { getContentEntrySlug } from '@/lib/content/events';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';
import type { Invitation, InvitationContentDraft } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

async function loadDemoContent(previewSlug: string): Promise<Record<string, unknown>> {
	const entries = await getCollection('event-demos');
	const entry = entries.find((e: { id: string }) => getContentEntrySlug(e.id) === previewSlug);
	return (entry?.data as Record<string, unknown>) ?? {};
}

export interface PublishResult {
	draft: InvitationContentDraft;
	publishedContent: {
		id: string;
		slug: string;
		eventType: string;
		version: number;
		publishedAt: string;
	};
}

async function synchronizeClientRsvp(
	invitation: Invitation,
	invitationId: string,
	publishSlug: string,
): Promise<void> {
	const [linkedEvent, slugEvent] = await Promise.all([
		findEventByInvitationIdService(invitationId),
		findEventBySlugService(publishSlug),
	]);
	if (linkedEvent && slugEvent && linkedEvent.id !== slugEvent.id) {
		throw new ApiError(
			409,
			'conflict',
			`El slug "${publishSlug}" ya está asociado a otro evento. Cambia el slug de la invitación antes de publicar.`,
		);
	}

	const existingEvent = linkedEvent ?? slugEvent;
	if (
		existingEvent?.eventType !== undefined &&
		existingEvent.eventType !== invitation.eventType
	) {
		throw new ApiError(
			409,
			'conflict',
			`El slug "${publishSlug}" ya está asociado a un evento de tipo "${existingEvent.eventType}" (se esperaba "${invitation.eventType}"). Cambia el slug de la invitación o el tipo de evento.`,
		);
	}
	if (existingEvent) {
		await updateEventService({
			eventId: existingEvent.id,
			title: invitation.title,
			slug: publishSlug,
			status: 'published',
			invitationId,
		});
		return;
	}

	await createEventService({
		ownerUserId: invitation.createdBy!,
		slug: publishSlug,
		eventType: invitation.eventType,
		title: invitation.title,
		status: 'published',
		invitationId,
	});
}

export async function publishDraft(invitationId: string): Promise<PublishResult> {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'Invitation not found.');
	}

	const draft = await findDraftByInvitationId(invitationId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontró un borrador para esta invitación.');
	}

	if (draft.status !== 'draft') {
		throw new ApiError(
			422,
			'invalid_draft_status',
			'Solo se puede publicar un borrador en estado "draft". Estado actual: ' + draft.status,
		);
	}

	const content = draft.content as unknown as DraftContent;
	if (!content || Object.keys(content).length === 0) {
		throw new ApiError(422, 'bad_request', 'El borrador no tiene contenido para publicar.');
	}

	const snapshot =
		invitation.snapshot ?? DEMO_PRESET_CATALOG.find((p) => p.id === invitation.baseDemoId);
	if (!snapshot) {
		throw new ApiError(
			422,
			'bad_request',
			'No se encontró la configuración de la invitación para publicar.',
		);
	}
	if (!snapshot.previewSlug) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración de la invitación no tiene slug de vista previa.',
		);
	}

	if (invitation.kind === 'client' && !invitation.createdBy) {
		throw new ApiError(
			422,
			'bad_request',
			'No se puede publicar sin un propietario asignado a la invitación. Asigna un propietario antes de publicar.',
		);
	}

	const demoContent = await loadDemoContent(snapshot.previewSlug);

	const publishedContent = mapDraftToPublished({
		invitation: {
			title: invitation.title,
			eventType: invitation.eventType,
			snapshot,
		},
		draftContent: content,
		demoContent,
		isDemo: invitation.kind === 'demo',
	});

	const publishSlug = invitation.slug || `${invitation.eventType}-${invitation.id.slice(0, 8)}`;

	const existingPublished = await findPublishedBySlugAndEventType(
		publishSlug,
		invitation.eventType,
	);
	if (existingPublished && existingPublished.invitationId !== invitationId) {
		throw new ApiError(
			409,
			'conflict',
			`El slug "${publishSlug}" ya está siendo utilizado por otra invitación de tipo ${invitation.eventType}. Cambia el slug de la invitación antes de publicar.`,
		);
	}

	if (invitation.kind === 'client') {
		await synchronizeClientRsvp(invitation, invitationId, publishSlug);
	}

	const result = await upsertPublishedContent({
		invitationId: invitationId,
		slug: publishSlug,
		eventType: invitation.eventType,
		isDemo: invitation.kind === 'demo',
		content: publishedContent,
	});

	await updateInvitation(invitationId, { status: 'published' });

	const updatedDraft = await updateDraftStatus(draft.id, 'approved');

	return {
		draft: updatedDraft,
		publishedContent: {
			id: result.id,
			slug: result.slug,
			eventType: result.eventType,
			version: result.version,
			publishedAt: result.publishedAt,
		},
	};
}
