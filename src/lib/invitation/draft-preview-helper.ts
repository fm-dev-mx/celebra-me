import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import { getPublicUrl } from '@/lib/intake/storage';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { Invitation } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { ALL_EDITOR_KEYS } from '@/lib/intake/constants';
import { getAssetSlugFromContent, resolveAssetSlug } from '@/lib/assets/asset-slug';

export type DraftPreviewResult =
	| { ok: true; pageContext: InvitationPageContext; invitationTitle: string; eventType: string }
	| { ok: false; error: { message: string } };

export function hasMeaningfulDraftContent(content: unknown): boolean {
	if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
	const record = content as Record<string, unknown>;
	return ALL_EDITOR_KEYS.some((key) => record[key] !== undefined);
}

export function selectPreviewContent(input: {
	draftContent?: Record<string, unknown> | null;
	publishedContent?: Record<string, unknown> | null;
}): { content: Record<string, unknown>; label: string; assetLookupSlug?: string } | null {
	const publishedAssetSlug = getAssetSlugFromContent(input.publishedContent);
	if (hasMeaningfulDraftContent(input.draftContent)) {
		return {
			content: input.draftContent as Record<string, unknown>,
			label: 'Borrador',
			assetLookupSlug:
				getAssetSlugFromContent(input.draftContent as Record<string, unknown>) ??
				publishedAssetSlug,
		};
	}
	if (input.publishedContent) {
		return {
			content: input.publishedContent,
			label: 'Versión pública',
			assetLookupSlug: publishedAssetSlug,
		};
	}
	return null;
}

/**
 * Resolve { type: 'uploaded', assetId } refs in draft content to public URLs
 * using the invitation's asset library.
 */
function resolveUploadedRefs(
	content: Record<string, unknown>,
	assets: Array<{ id: string; bucket: string; storagePath: string }>,
): Record<string, unknown> {
	const assetMap = new Map(
		assets.map((a) => [a.id, { bucket: a.bucket, storagePath: a.storagePath }]),
	);

	function walk(value: unknown): unknown {
		if (!value || typeof value !== 'object') return value;
		const obj = value as Record<string, unknown>;
		if (obj.type === 'uploaded' && typeof obj.assetId === 'string' && !obj.src) {
			const record = assetMap.get(obj.assetId as string);
			if (record) {
				return { ...obj, src: getPublicUrl(record.bucket, record.storagePath) };
			}
			return obj;
		}
		if (Array.isArray(value)) {
			return value.map(walk);
		}
		const result: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(obj)) {
			result[key] = walk(child);
		}
		return result;
	}

	return walk(content) as Record<string, unknown>;
}

export async function buildDraftPreviewPageContext(
	invitation: Invitation,
	draftContent: DraftContent,
	demoContent: Record<string, unknown>,
	options: { assetLookupSlug?: string } = {},
): Promise<DraftPreviewResult> {
	try {
		const snapshot = invitation.snapshot;
		const contentSlug = invitation.slug ?? snapshot.previewSlug;
		const assetLookupSlug =
			getAssetSlugFromContent(draftContent as unknown as Record<string, unknown>) ??
			options.assetLookupSlug ??
			resolveAssetSlug(invitation);

		// Resolve uploaded asset refs to public Storage URLs for preview
		let resolvedContent = draftContent as unknown as Record<string, unknown>;
		try {
			const assets = await findAssetsByInvitationId(invitation.id);
			resolvedContent = resolveUploadedRefs(resolvedContent, assets);
		} catch {
			// If the invitation_assets table doesn't exist or assets can't be fetched,
			// continue with unresolved refs — demo/internal assets will still work.
		}

		const publishedData = mapDraftToPublished({
			invitation: {
				title: invitation.title,
				eventType: invitation.eventType,
				snapshot,
			},
			assetSlug: assetLookupSlug,
			draftContent: resolvedContent as DraftContent,
			demoContent,
			isDemo: invitation.kind === 'demo',
		});

		const viewModel = adaptDbEvent({
			slug: contentSlug,
			eventType: invitation.eventType,
			isDemo: false,
			content: publishedData,
			assetSlug: assetLookupSlug,
		});

		const pageContext = buildPageContextFromViewModel({
			viewModel,
			slug: contentSlug,
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
