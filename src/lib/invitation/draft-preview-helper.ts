import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { Invitation } from '@/lib/intake/types';

export type DraftPreviewResult =
	| { ok: true; pageContext: InvitationPageContext; invitationTitle: string; eventType: string }
	| { ok: false; error: { message: string } };

export function buildDraftPreviewPageContext(
	invitation: Invitation,
	draftContent: Record<string, unknown>,
	demoContent: Record<string, unknown>,
): DraftPreviewResult {
	try {
		const snapshot = invitation.snapshot;

		const publishedData = mapDraftToPublished({
			invitation: {
				title: invitation.title,
				eventType: invitation.eventType,
				snapshot,
			},
			draftContent: draftContent as Parameters<typeof mapDraftToPublished>[0]['draftContent'],
			demoContent,
		});

		const viewModel = adaptDbEvent({
			slug: snapshot.previewSlug,
			eventType: invitation.eventType,
			isDemo: false,
			content: publishedData,
			assetSlug: snapshot.previewSlug,
		});

		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: snapshot.previewSlug,
			eventType: invitation.eventType,
			isPreview: true,
		});

		return {
			ok: true,
			pageContext,
			invitationTitle: invitation.title,
			eventType: invitation.eventType,
		};
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
