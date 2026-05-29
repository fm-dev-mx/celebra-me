import {
	findDraftByProjectId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { upsertPublishedContent } from '@/lib/intake/repositories/published-invitation-content.repository';
import { getInvitationProjectById } from '@/lib/intake/services/invitation-project.service';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { ApiError } from '@/lib/rsvp/core/errors';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';
import type { InvitationContentDraft } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

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
	const project = await getInvitationProjectById(projectId);
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
			'No se encontro la configuracion del proyecto para publicar.',
		);
	}

	const publishedContent = mapDraftToPublished({
		project: {
			title: project.title,
			eventType: project.eventType,
			snapshot,
		},
		draftContent: content,
	});

	const publishSlug = project.slug || `${project.eventType}-${project.id.slice(0, 8)}`;

	const result = await upsertPublishedContent({
		invitationProjectId: projectId,
		slug: publishSlug,
		eventType: project.eventType,
		isDemo: false,
		content: publishedContent,
	});

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
