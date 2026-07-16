import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import {
	findPublishedByInvitationId,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getPublicSlug } from '@/lib/intake/slug';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import { getPublicUrl } from '@/lib/intake/storage';
import type { InvitationAsset, InvitationContentDraft } from '@/lib/intake/types';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { loadDemoContent } from '@/lib/intake/editor-api';
import { isValidEvent, getEventAsset, isEventAssetKey } from '@/lib/assets/asset-registry';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import {
	checkPublishGuard,
	resolveInvitationTheme,
} from '@/lib/intake/services/invitation-preset-resolver';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { commitAtomicPublication } from '@/lib/intake/repositories/publication.repository';
import {
	ASSET_POLICY_VERSION,
	MAX_OUTPUT_BYTES,
	MAX_OUTPUT_DIMENSION,
	OUTPUT_MIME_TYPE,
} from '@/lib/intake/services/asset-policy';

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

/**
 * Walk content recursively and freeze all { type: 'uploaded', assetId }
 * references to { type: 'uploaded', assetId, src } using the asset library.
 * Throws if an uploaded asset cannot be resolved.
 */
async function freezeUploadedContentRefs(
	content: Record<string, unknown>,
	invitationId: string,
	priorPublishedContent?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const assets = await findAssetsByInvitationId(invitationId);
	const assetMap = new Map(assets.map((a) => [a.id, a]));
	const legacyPublishedAssetIds = collectUploadedAssetIds(priorPublishedContent);

	function walk(value: unknown, path = ''): unknown {
		if (!value || typeof value !== 'object') return value;
		const obj = value as Record<string, unknown>;

		if (obj.type === 'uploaded' && typeof obj.assetId === 'string') {
			const assetId = obj.assetId as string;
			const asset = assetMap.get(assetId);
			if (!asset) {
				throw new ApiError(
					422,
					'bad_request',
					`No se pudo resolver la imagen "${assetId.slice(0, 8)}". El recurso fue eliminado de la biblioteca.`,
				);
			}
			assertUploadedAssetPolicy(asset, path, legacyPublishedAssetIds.has(assetId));
			return { ...obj, src: getPublicUrl(asset.bucket, asset.storagePath) };
		}

		if (Array.isArray(value)) {
			return value.map((child, index) => walk(child, `${path}[${index}]`));
		}

		const result: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(obj)) {
			result[key] = walk(child, path ? `${path}.${key}` : key);
		}
		return result;
	}

	return walk(content) as Record<string, unknown>;
}

function collectUploadedAssetIds(content?: Record<string, unknown>): Set<string> {
	const ids = new Set<string>();
	const walk = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(walk);
			return;
		}
		const obj = value as Record<string, unknown>;
		if (obj.type === 'uploaded' && typeof obj.assetId === 'string') ids.add(obj.assetId);
		Object.values(obj).forEach(walk);
	};
	walk(content);
	return ids;
}

function assertUploadedAssetPolicy(
	asset: InvitationAsset,
	path: string,
	isPreviouslyPublished: boolean,
): void {
	if ((asset.validationVersion ?? ASSET_POLICY_VERSION) < ASSET_POLICY_VERSION) {
		if (isPreviouslyPublished) return;
		throw new ApiError(
			422,
			'validation_error',
			'Una imagen seleccionada es anterior al control de calidad. Vuelve a subirla antes de publicar.',
			{ reason: 'asset_not_validated', assetId: asset.id, path },
		);
	}

	if (
		asset.mimeType !== OUTPUT_MIME_TYPE ||
		!asset.width ||
		!asset.height ||
		!asset.fileSize ||
		asset.fileSize > MAX_OUTPUT_BYTES ||
		asset.width > MAX_OUTPUT_DIMENSION ||
		asset.height > MAX_OUTPUT_DIMENSION
	) {
		throw new ApiError(
			422,
			'validation_error',
			'Una imagen no tiene metadatos de entrega válidos. Vuelve a subirla antes de publicar.',
			{ reason: 'asset_metadata_invalid', assetId: asset.id, path },
		);
	}

	const longSide = Math.max(asset.width, asset.height);
	const shortSide = Math.min(asset.width, asset.height);
	const minimum = path.startsWith('hero.backgroundImage')
		? { longSide: 1200, shortSide: 720, role: 'portada' }
		: path === 'hero.portrait'
			? { longSide: 960, shortSide: 640, role: 'retrato' }
			: path === 'sharing.ogImage'
				? { longSide: 1200, shortSide: 630, role: 'imagen para compartir' }
				: { longSide: 800, shortSide: 480, role: 'sección' };

	if (longSide < minimum.longSide || shortSide < minimum.shortSide) {
		throw new ApiError(
			422,
			'validation_error',
			`La imagen usada como ${minimum.role} no tiene resolución suficiente para publicarse.`,
			{
				reason: 'asset_dimensions_insufficient',
				assetId: asset.id,
				path,
				width: asset.width,
				height: asset.height,
				requiredLongSide: minimum.longSide,
				requiredShortSide: minimum.shortSide,
			},
		);
	}
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
	const HERO_ASSET_FIELDS = [
		'backgroundImage',
		'backgroundImageDesktop',
		'backgroundImageMobile',
		'portrait',
	] as const;
	for (const field of HERO_ASSET_FIELDS) {
		tryAddAssetRef(refs, `hero.${field}`, hero?.[field]);
	}

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

function assertCountdownHasTiming(content: Record<string, unknown>): void {
	const countdown = content.countdown;
	if (!countdown || typeof countdown !== 'object' || Object.keys(countdown).length === 0) {
		return;
	}
	const sectionOrder = content.sectionOrder;
	if (Array.isArray(sectionOrder) && !sectionOrder.includes('countdown')) {
		return;
	}
	const eventTiming = content.eventTiming as Record<string, unknown> | undefined;
	const startsAtUtc = eventTiming?.startsAtUtc;
	if (!startsAtUtc || typeof startsAtUtc !== 'string') {
		throw new ApiError(
			422,
			'bad_request',
			'La cuenta regresiva necesita fecha, hora y zona horaria válidas. Revisa "Fecha y ubicaciones" en el editor antes de publicar.',
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

	const priorPublished = await findPublishedByInvitationId(invitationId);
	const effectiveDraftContent = computeEffectiveContent(draft.content, priorPublished?.content);
	if (Object.keys(effectiveDraftContent).length === 0) {
		throw new ApiError(422, 'bad_request', 'El borrador no tiene contenido para publicar.');
	}

	const guardResult = checkPublishGuard(invitation);
	if (!guardResult.ok) {
		throw new ApiError(422, 'config_error', guardResult.errors.join(' '));
	}
	const resolvedTheme = resolveInvitationTheme(invitation);
	const catalogEntry = findDemoPreset(invitation.baseDemoId);
	const snapshot = catalogEntry ?? invitation.snapshot;
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
	const rawSlug = resolveAssetSlug(invitation, priorPublished?.content);
	if (!rawSlug) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración de la invitación no tiene slug de vista previa.',
		);
	}
	if (!isValidEvent(rawSlug)) {
		throw new ApiError(
			422,
			'bad_request',
			'La configuración visual de esta invitación no es válida. No se encontraron los recursos gráficos asociados.',
		);
	}
	const assetSlug = rawSlug;

	const mappedContent = mapDraftToPublished({
		invitation: {
			title: invitation.title,
			eventType: invitation.eventType,
			snapshot: { ...snapshot, themeId: resolvedTheme },
		},
		assetSlug,
		draftContent: effectiveDraftContent,
		demoContent,
		isDemo: invitation.kind === 'demo',
	});

	// Freeze uploaded asset refs before validation
	const frozenContent = await freezeUploadedContentRefs(
		mappedContent,
		invitationId,
		priorPublished?.content,
	);

	assertCountdownHasTiming(frozenContent);

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

	return commitAtomicPublication({
		invitationId,
		draftId: draft.id,
		expectedDraftUpdatedAt: draft.updatedAt,
		slug: publishSlug,
		eventType: invitation.eventType,
		isDemo: invitation.kind === 'demo',
		content: publishedContent,
	});
}
