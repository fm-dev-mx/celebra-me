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
import { ApiError } from '@/lib/rsvp/core/errors';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';
import { getPublicSlug } from '@/lib/intake/slug';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import { getPublicUrl } from '@/lib/intake/storage';
import type { Invitation, InvitationContentDraft } from '@/lib/intake/types';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { loadDemoContent } from '@/lib/intake/editor-api';
import { isValidEvent, getEventAsset, isEventAssetKey } from '@/lib/assets/asset-registry';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';

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

function resolvePublishAssetSlug(previewSlug: string | undefined): string {
	if (!previewSlug) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración de la invitación no tiene slug de vista previa.',
		);
	}
	if (!isValidEvent(previewSlug)) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración visual de esta invitación no es válida. No se encontraron los recursos gráficos asociados.',
		);
	}
	return previewSlug;
}

/**
 * Walk content recursively and freeze all { type: 'uploaded', assetId }
 * references to { type: 'uploaded', assetId, src } using the asset library.
 * Throws if an uploaded asset cannot be resolved.
 */
async function freezeUploadedContentRefs(
	content: Record<string, unknown>,
	invitationId: string,
): Promise<Record<string, unknown>> {
	const assets = await findAssetsByInvitationId(invitationId);
	const assetMap = new Map(assets.map((a) => [a.id, a]));

	function walk(value: unknown): unknown {
		if (!value || typeof value !== 'object') return value;
		const obj = value as Record<string, unknown>;

		if (obj.type === 'uploaded' && typeof obj.assetId === 'string' && !obj.src) {
			const assetId = obj.assetId as string;
			const asset = assetMap.get(assetId);
			if (!asset) {
				throw new ApiError(
					422,
					'bad_request',
					`No se pudo resolver la imagen "${assetId.slice(0, 8)}". El recurso fue eliminado de la biblioteca.`,
				);
			}
			return { ...obj, src: getPublicUrl(asset.bucket, asset.storagePath) };
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

interface AssetRefEntry {
	path: string;
	key: string;
}

function tryAddAssetRef(refs: AssetRefEntry[], path: string, candidate: unknown): void {
	const obj = candidate as { type?: string; key?: string } | undefined;
	if (obj?.type === 'internal' && obj.key) {
		refs.push({ path, key: obj.key });
	}
}

/**
 * Collect all { type: 'internal', key } asset references from the published
 * content structure. Covers hero, portrait, gallery, venue, interludes,
 * family, thankYou, and sharing/OG images.
 */
function collectPublishedAssetRefs(content: Record<string, unknown>): AssetRefEntry[] {
	const refs: AssetRefEntry[] = [];

	const hero = content.hero as Record<string, unknown> | undefined;
	tryAddAssetRef(refs, 'hero.backgroundImage', hero?.backgroundImage);
	tryAddAssetRef(refs, 'hero.backgroundImageMobile', hero?.backgroundImageMobile);
	tryAddAssetRef(refs, 'hero.portrait', hero?.portrait);

	const family = content.family as
		| { featuredImage?: { type?: string; key?: string } }
		| undefined;
	tryAddAssetRef(refs, 'family.featuredImage', family?.featuredImage);

	const location = content.location as
		| {
				ceremony?: { image?: { type?: string; key?: string } };
				reception?: { image?: { type?: string; key?: string } };
		  }
		| undefined;
	if (location) {
		tryAddAssetRef(refs, 'location.ceremony.image', location.ceremony?.image);
		tryAddAssetRef(refs, 'location.reception.image', location.reception?.image);
	}

	const gallery = content.gallery as
		| { items?: Array<{ image?: { type?: string; key?: string } }> }
		| undefined;
	if (gallery?.items) {
		gallery.items.forEach((item, index) => {
			tryAddAssetRef(refs, `gallery.items[${index}].image`, item?.image);
		});
	}

	const interludes = content.interludes as
		| Array<{ image?: { type?: string; key?: string } }>
		| undefined;
	if (interludes) {
		interludes.forEach((item, index) => {
			tryAddAssetRef(refs, `interludes[${index}].image`, item?.image);
		});
	}

	const thankYou = content.thankYou as { image?: { type?: string; key?: string } } | undefined;
	tryAddAssetRef(refs, 'thankYou.image', thankYou?.image);

	const sharing = content.sharing as { ogImage?: { type?: string; key?: string } } | undefined;
	tryAddAssetRef(refs, 'sharing.ogImage', sharing?.ogImage);

	return refs;
}

/**
 * Validate that every internal asset reference in the published content
 * resolves against the given assetSlug. Required missing assets block
 * publishing; optional missing assets also block when explicitly referenced
 * but unresolvable (they would produce a broken public page).
 * Reports ALL failures at once instead of failing at the first one.
 */
function assertAllAssetsResolvable(
	publishedContent: Record<string, unknown>,
	assetSlug: string,
): void {
	const refs = collectPublishedAssetRefs(publishedContent);
	const unresolved: AssetRefEntry[] = [];

	for (const ref of refs) {
		if (isEventAssetKey(ref.key) && !getEventAsset(assetSlug, ref.key)) {
			unresolved.push(ref);
		}
	}

	if (unresolved.length > 0) {
		const details = unresolved.map((r) => `"${r.key}" (${r.path})`).join(', ');
		throw new ApiError(
			422,
			'bad_request',
			`No se pudieron resolver los siguientes recursos visuales necesarios para publicar: ${details}. Verifica que los recursos estén completos en la biblioteca de imágenes del tema.`,
			{ unresolved: unresolved.map((r) => ({ path: r.path, key: r.key })) },
		);
	}
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

	if (invitation.kind === 'client' && !invitation.createdBy) {
		throw new ApiError(
			422,
			'bad_request',
			'No se puede publicar sin un propietario asignado a la invitación. Asigna un propietario antes de publicar.',
		);
	}

	const demoContent = await loadDemoContent(snapshot.previewSlug);

	const publishSlug = getPublicSlug(invitation);
	const assetSlug = resolvePublishAssetSlug(resolveAssetSlug(invitation));

	const mappedContent = mapDraftToPublished({
		invitation: {
			title: invitation.title,
			eventType: invitation.eventType,
			snapshot,
		},
		assetSlug,
		draftContent: content,
		demoContent,
		isDemo: invitation.kind === 'demo',
	});

	// Freeze uploaded asset refs before validation
	const frozenContent = await freezeUploadedContentRefs(mappedContent, invitationId);

	const publishedContentResult = eventContentSchema.safeParse(frozenContent);
	if (!publishedContentResult.success) {
		const invalidPaths = publishedContentResult.error.issues
			.map((issue) => issue.path.join('.'))
			.filter(Boolean)
			.join(', ');
		throw new ApiError(
			422,
			'bad_request',
			`La revisión contiene datos incompletos o inválidos. Corrige los campos marcados antes de publicar.${invalidPaths ? ` Campos: ${invalidPaths}.` : ''}`,
			{ issues: publishedContentResult.error.issues },
		);
	}
	const publishedContent = publishedContentResult.data;

	assertAllAssetsResolvable(publishedContent as Record<string, unknown>, assetSlug);

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
