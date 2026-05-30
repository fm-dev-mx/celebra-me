import { getCollection } from 'astro:content';
import {
	findDraftByProjectId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	upsertPublishedContent,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findInvitationProjectById,
	updateInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import {
	findEventBySlugService,
	createEventService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { getContentEntrySlug } from '@/lib/content/events';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';
import type { InvitationContentDraft } from '@/lib/intake/types';
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

export async function publishDraft(projectId: string): Promise<PublishResult> {
	const project = await findInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Invitation project not found.');
	}

	const draft = await findDraftByProjectId(projectId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontro un borrador para este proyecto.');
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
		project.snapshot ?? DEMO_PRESET_CATALOG.find((p) => p.id === project.baseDemoId);
	if (!snapshot) {
		throw new ApiError(
			422,
			'bad_request',
			'No se encontro la configuración del proyecto para publicar.',
		);
	}
	if (!snapshot.previewSlug) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración del proyecto no tiene slug de vista previa.',
		);
	}

	if (!project.createdBy) {
		throw new ApiError(
			422,
			'bad_request',
			'No se puede publicar sin un propietario asignado al proyecto. Asigna un propietario antes de publicar.',
		);
	}

	const demoContent = await loadDemoContent(snapshot.previewSlug);

	const publishedContent = mapDraftToPublished({
		project: {
			title: project.title,
			eventType: project.eventType,
			snapshot,
		},
		draftContent: content,
		demoContent,
	});

	const publishSlug = project.slug || `${project.eventType}-${project.id.slice(0, 8)}`;

	const existingPublished = await findPublishedBySlugAndEventType(publishSlug, project.eventType);
	if (existingPublished && existingPublished.invitationProjectId !== projectId) {
		throw new ApiError(
			409,
			'conflict',
			`El slug "${publishSlug}" ya está siendo utilizado por otro proyecto de tipo ${project.eventType}. Cambia el slug del proyecto antes de publicar.`,
		);
	}

	const existingEvent = await findEventBySlugService(publishSlug);
	if (existingEvent) {
		if (existingEvent.eventType !== project.eventType) {
			throw new ApiError(
				409,
				'conflict',
				`El slug "${publishSlug}" ya está asociado a un evento de tipo "${existingEvent.eventType}" (se esperaba "${project.eventType}"). Cambia el slug del proyecto o el tipo de evento.`,
			);
		}
		await updateEventService({
			eventId: existingEvent.id,
			title: project.title,
			status: 'published',
			invitationProjectId: projectId,
		});
	} else {
		await createEventService({
			ownerUserId: project.createdBy,
			slug: publishSlug,
			eventType: project.eventType,
			title: project.title,
			status: 'published',
			invitationProjectId: projectId,
		});
	}

	const result = await upsertPublishedContent({
		invitationProjectId: projectId,
		slug: publishSlug,
		eventType: project.eventType,
		isDemo: false,
		content: publishedContent,
	});

	await updateInvitationProject(projectId, { status: 'published' });

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
