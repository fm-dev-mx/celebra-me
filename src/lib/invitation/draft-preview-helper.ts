import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { InvitationProject } from '@/lib/intake/types';

export type DraftPreviewResult =
	| { ok: true; pageContext: InvitationPageContext; projectTitle: string; eventType: string }
	| { ok: false; error: { message: string } };

export function buildDraftPreviewPageContext(
	project: InvitationProject,
	draftContent: Record<string, unknown>,
	demoContent: Record<string, unknown>,
): DraftPreviewResult {
	try {
		const snapshot = project.snapshot;

		const publishedData = mapDraftToPublished({
			project: {
				title: project.title,
				eventType: project.eventType,
				snapshot,
			},
			draftContent: draftContent as Parameters<typeof mapDraftToPublished>[0]['draftContent'],
			demoContent,
		});

		const viewModel = adaptDbEvent({
			slug: snapshot.previewSlug,
			eventType: project.eventType,
			isDemo: false,
			content: publishedData,
			assetSlug: snapshot.previewSlug,
		});

		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: snapshot.previewSlug,
			eventType: project.eventType,
			isPreview: true,
		});

		return { ok: true, pageContext, projectTitle: project.title, eventType: project.eventType };
	} catch {
		return {
			ok: false,
			error: {
				message:
					'Error al generar la vista previa. Revisa que el contenido del borrador sea válido.',
			},
		};
	}
}
