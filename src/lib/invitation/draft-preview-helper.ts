import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import { preferUploadedDeliverySrc } from '@/lib/intake/services/asset-delivery';
import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { Invitation } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { ALL_EDITOR_KEYS } from '@/lib/intake/constants';
import { getAssetSlugFromContent, resolveAssetSlug } from '@/lib/assets/asset-slug';
import { CANONICAL_VARIANT_REGISTRY } from '@/lib/invitation/section-variants';
import { isRecord } from '@/lib/shared/data-utils';

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
	assets: Array<{
		id: string;
		bucket: string;
		storagePath: string;
		provider?: string;
		providerPublicId?: string;
		secureUrl?: string;
	}>,
): Record<string, unknown> {
	const assetMap = new Map(assets.map((a) => [a.id, a]));

	function walk(value: unknown): unknown {
		if (!value || typeof value !== 'object') return value;
		const obj = value as Record<string, unknown>;
		if (obj.type === 'uploaded' && typeof obj.assetId === 'string') {
			const record = assetMap.get(obj.assetId as string);
			if (!record) return obj;
			const frozenSrc = typeof obj.src === 'string' ? obj.src : null;
			const src = preferUploadedDeliverySrc({
				asset: {
					id: record.id,
					provider: record.provider,
					bucket: record.bucket,
					storagePath: record.storagePath,
					providerPublicId: record.providerPublicId,
					secureUrl: record.secureUrl,
				},
				frozenSrc,
			});
			return { ...obj, src };
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

function buildPreviewStructuralContract(
	demoContent: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!Array.isArray(demoContent.sectionOrder) || !isRecord(demoContent.composition)) {
		return undefined;
	}

	const contract: Record<string, unknown> = {
		sectionOrder: demoContent.sectionOrder,
		composition: demoContent.composition,
	};
	for (const section of new Set(CANONICAL_VARIANT_REGISTRY.map((entry) => entry.section))) {
		const source =
			section === 'personalizedAccess'
				? (demoContent.rsvp as Record<string, unknown> | undefined)?.personalizedAccess
				: demoContent[section];
		if (!isRecord(source) || typeof source.variant !== 'string') continue;
		if (section === 'personalizedAccess') {
			const priorRsvp = isRecord(contract.rsvp) ? contract.rsvp : {};
			contract.rsvp = {
				...priorRsvp,
				personalizedAccess: { variant: source.variant },
			};
		} else {
			contract[section] = { variant: source.variant };
		}
	}
	return contract;
}

export async function buildDraftPreviewPageContext(
	invitation: Invitation,
	draftContent: DraftContent,
	demoContent: Record<string, unknown>,
	options: {
		assetLookupSlug?: string;
		/** Same prior snapshot publish uses — restores non-editable managed fields in preview. */
		priorPublishedContent?: Record<string, unknown> | null;
	} = {},
): Promise<DraftPreviewResult> {
	try {
		const snapshot = invitation.snapshot;
		const contentSlug = invitation.slug ?? snapshot.previewSlug;
		const assetLookupSlug =
			getAssetSlugFromContent(draftContent as unknown as Record<string, unknown>) ??
			options.assetLookupSlug ??
			resolveAssetSlug(invitation, undefined, demoContent);

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
			priorPublishedContent:
				options.priorPublishedContent ?? buildPreviewStructuralContract(demoContent),
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
