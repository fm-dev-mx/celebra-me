import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { randomUUID } from 'node:crypto';
import {
	findPublishedByInvitationId,
	findPublishedBySlugAndEventType,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { mapDraftToPublished } from '@/lib/intake/mappers/draft-to-published.mapper';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getPublicSlug } from '@/lib/intake/slug';
import { findAssetsByInvitationId } from '@/lib/intake/repositories/asset.repository';
import { preferUploadedDeliverySrc } from '@/lib/intake/services/asset-delivery';
import type {
	Invitation,
	InvitationAsset,
	InvitationContentDraft,
	DemoPreset,
} from '@/lib/intake/types';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { loadDemoContent } from '@/lib/intake/editor-api';
import { isValidEvent, getEventAsset, isEventAssetKey } from '@/lib/assets/asset-registry';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';
import { computeEffectiveContent } from '@/lib/intake/services/merge-content.service';
import { DraftNormalizationError } from '@/lib/intake/services/draft-content-mapper';
import {
	checkPublishGuard,
	resolveInvitationTheme,
} from '@/lib/intake/services/invitation-preset-resolver';
import { findPlaceholderTokensInValue } from '@/lib/invitation-preparation/placeholders';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import {
	commitAtomicPublication,
	replayAtomicPublication,
} from '@/lib/intake/repositories/publication.repository';
import { clearManagedProjectionAncestor } from '@/lib/intake/repositories/managed-release-provenance.repository';
import {
	createPublicationComparison,
	hashPublicMetadata,
	hashPublicationProjection,
} from '@/lib/intake/services/publication-diff.service';
import {
	ASSET_POLICY_VERSION,
	MAX_OUTPUT_BYTES,
	MAX_OUTPUT_DIMENSION,
	OUTPUT_MIME_TYPE,
	ROLE_AWARE_ASSET_POLICY_VERSION,
} from '@/lib/intake/services/asset-policy';
import {
	getImageOptimizationRoleForPath,
	getWeightTargetBytes,
} from '@/lib/invitation-preparation/image-optimization';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { createMutationOutcome, type MutationOutcome } from '@/lib/intake/mutations/outcome';
import {
	ensurePartialMutationParent,
	recordInvitationMutationOutcome,
} from '@/lib/intake/services/mutation-operation.service';

export interface PublishResult {
	draft: InvitationContentDraft;
	publishedContent: {
		id: string;
		slug: string;
		eventType: string;
		version: number;
		publishedAt: string;
	};
	idempotent?: boolean;
	outcome?: MutationOutcome;
}

async function finalizePublicationProvenance(input: {
	invitationId: string;
	result: PublishResult;
	context?: InvitationMutationCommandContext;
	replayed?: boolean;
}): Promise<PublishResult> {
	const completedSteps = ['publication_committed'];
	try {
		await clearManagedProjectionAncestor(input.invitationId);
		completedSteps.push('managed_provenance_invalidated');
	} catch (error) {
		if (!input.context) {
			return {
				...input.result,
				outcome: createMutationOutcome({
					operationId: randomUUID(),
					status: 'partial',
					completedSteps,
					error,
				}),
			};
		}
		try {
			await recordInvitationMutationOutcome({
				context: input.context,
				invitationId: input.invitationId,
				commandKind: 'publish_invitation',
				status: 'partial',
				completedSteps,
				result: { publishedVersion: input.result.publishedContent.version },
				error,
			});
		} catch {
			// The publication idempotency record still permits deterministic reconciliation.
		}
		return {
			...input.result,
			outcome: createMutationOutcome({
				operationId: input.context.operationId,
				status: 'partial',
				completedSteps,
				error,
			}),
		};
	}

	if (!input.context) return input.result;
	const status = input.replayed ? 'replayed' : 'applied';
	try {
		const outcome = await recordInvitationMutationOutcome({
			context: input.context,
			invitationId: input.invitationId,
			commandKind: 'publish_invitation',
			status,
			completedSteps,
			result: { publishedVersion: input.result.publishedContent.version },
		});
		return { ...input.result, outcome };
	} catch (error) {
		return {
			...input.result,
			outcome: createMutationOutcome({
				operationId: input.context.operationId,
				status: 'partial',
				completedSteps,
				error,
			}),
		};
	}
}

export interface PublicationPreflight {
	changedPaths: string[];
	changedSections: Array<{ path: string; sectionId: string; sectionLabel: string }>;
	draftRevision: string;
	publishedVersion: number | null;
	publicMetadataHash: string;
	projectionHash: string;
}

export interface PublishPreflightInput {
	draftRevision: string;
	publishedVersion: number | null;
	publicMetadataHash: string;
	projectionHash: string;
	idempotencyKey: string;
}

function parsePublicationProjection(content: Record<string, unknown>): Record<string, unknown> {
	const result = eventContentSchema.safeParse(content);
	if (result.success) return result.data as Record<string, unknown>;

	const invalidPaths = result.error.issues
		.map((issue) => issue.path.join('.'))
		.filter(Boolean)
		.join(', ');
	throw new ApiError(
		422,
		'bad_request',
		`La revisión contiene datos incompletos o inválidos. Corrige los campos marcados antes de publicar.${invalidPaths ? ` Campos: ${invalidPaths}.` : ''}`,
		{ issues: result.error.issues },
	);
}

function normalizePublishedProjection(content: Record<string, unknown>): Record<string, unknown> {
	const result = eventContentSchema.safeParse(content);
	return result.success ? (result.data as Record<string, unknown>) : content;
}

function resolvePublicationConfiguration(invitation: Invitation) {
	const guardResult = checkPublishGuard(invitation);
	if (!guardResult.ok) throw new ApiError(422, 'config_error', guardResult.errors.join(' '));
	const snapshot = findDemoPreset(invitation.baseDemoId) ?? invitation.snapshot;
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
	return {
		publishSlug: getPublicSlug(invitation),
		resolvedTheme: resolveInvitationTheme(invitation),
		snapshot,
	};
}

async function resolvePublicationValidationContext(
	invitation: Invitation,
	priorPublished: Awaited<ReturnType<typeof findPublishedByInvitationId>>,
	stage: 'preflight' | 'publish',
) {
	const configuration = resolvePublicationConfiguration(invitation);
	const demoContent = await loadDemoContent(configuration.snapshot.previewSlug);
	const assetSlug = resolveAssetSlug(invitation, priorPublished?.content, demoContent);

	if (!assetSlug) throwVisualResolutionError(invitation.id, assetSlug, stage);

	return { ...configuration, assetSlug, demoContent };
}

interface ValidatePublicationOptions {
	invitation: Invitation;
	draft: InvitationContentDraft;
	priorPublished: Awaited<ReturnType<typeof findPublishedByInvitationId>> | undefined | null;
	assetSlug: string;
	resolvedTheme: string;
	snapshot: DemoPreset;
	demoContent: Record<string, unknown>;
	stage: 'preflight' | 'publish';
}

async function validatePublication(
	invitationId: string,
	options: ValidatePublicationOptions,
): Promise<{
	mappedContent: Record<string, unknown>;
	publicationProjection: Record<string, unknown>;
	frozenContent: Record<string, unknown>;
	publishedContent: Record<string, unknown>;
}> {
	const { invitation, draft, priorPublished, assetSlug, resolvedTheme, snapshot, demoContent } =
		options;

	let effectiveDraftContent;
	try {
		effectiveDraftContent = computeEffectiveContent(draft.content, priorPublished?.content);
	} catch (error) {
		if (error instanceof DraftNormalizationError) {
			throw new ApiError(
				422,
				'bad_request',
				'El borrador guardado conserva datos que el editor no puede representar. Ejecuta la canonicalización del borrador antes de publicarlo.',
				{ issues: error.issues },
			);
		}
		throw error;
	}
	if (Object.keys(effectiveDraftContent).length === 0) {
		throw new ApiError(422, 'bad_request', 'El borrador no tiene contenido para publicar.');
	}

	const mappedContent = mapDraftToPublished({
		invitation: {
			title: invitation.title,
			eventType: invitation.eventType,
			snapshot: { ...snapshot, themeId: resolvedTheme as DemoPreset['themeId'] },
		},
		assetSlug,
		draftContent: effectiveDraftContent,
		demoContent,
		priorPublishedContent: priorPublished?.content,
		isDemo: invitation.kind === 'demo',
	});

	const publicationProjection = parsePublicationProjection(mappedContent);

	// Freeze uploaded asset refs before validation
	const frozenContent = await freezeUploadedContentRefs(
		publicationProjection,
		invitationId,
		priorPublished?.content,
	);

	assertCountdownHasTiming(frozenContent);

	const publishedContent = parsePublicationProjection(frozenContent);
	if (options.stage === 'publish') {
		const pendingTokens = findPlaceholderTokensInValue(publishedContent);
		if (pendingTokens.length > 0) {
			throw new ApiError(
				422,
				'validation_error',
				'La publicación contiene datos pendientes de confirmación. Reemplace los placeholders antes de publicar.',
				{ reason: 'published_content_placeholders', tokens: pendingTokens },
			);
		}
	}

	assertAllAssetsResolvable(publishedContent, {
		assetSlug,
		invitationId,
		stage: options.stage,
	});

	return {
		mappedContent,
		publicationProjection,
		frozenContent,
		publishedContent,
	};
}

export async function getPublicationPreflight(invitationId: string): Promise<PublicationPreflight> {
	const [invitation, draft, published] = await Promise.all([
		findInvitationById(invitationId),
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);
	if (!invitation) throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	if (!draft || draft.status !== 'draft') {
		throw new ApiError(409, 'conflict', 'No hay un borrador disponible para revisar.');
	}

	const { assetSlug, snapshot, resolvedTheme, demoContent } =
		await resolvePublicationValidationContext(invitation, published, 'preflight');

	const { publicationProjection } = await validatePublication(invitationId, {
		invitation,
		draft,
		priorPublished: published,
		assetSlug,
		resolvedTheme,
		snapshot,
		demoContent,
		stage: 'preflight',
	});

	const comparison = createPublicationComparison({
		draftProjection: {
			content: publicationProjection,
			metadata: { title: invitation.title, slug: getPublicSlug(invitation) },
		},
		publishedProjection: published
			? {
					content: normalizePublishedProjection(published.content),
					metadata: {
						title:
							typeof published.content.title === 'string'
								? published.content.title
								: undefined,
						slug: published.slug,
					},
				}
			: undefined,
	});
	return {
		changedPaths: comparison.changedPaths,
		changedSections: comparison.changedSections,
		draftRevision: draft.updatedAt,
		publishedVersion: published?.version ?? null,
		publicMetadataHash: hashPublicMetadata(invitation, published?.content),
		projectionHash: hashPublicationProjection(publicationProjection),
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
			const frozenSrc = typeof obj.src === 'string' ? obj.src : null;
			const src = preferUploadedDeliverySrc({
				asset: {
					id: asset.id,
					provider: asset.provider,
					bucket: asset.bucket,
					storagePath: asset.storagePath,
					providerPublicId: asset.providerPublicId,
					secureUrl: asset.secureUrl,
				},
				frozenSrc,
			});
			return { ...obj, src };
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

	if ((asset.validationVersion ?? ASSET_POLICY_VERSION) >= ROLE_AWARE_ASSET_POLICY_VERSION) {
		const role = getImageOptimizationRoleForPath(path);
		const maxBytes = getWeightTargetBytes(role);
		if (asset.fileSize > maxBytes) {
			throw new ApiError(
				422,
				'validation_error',
				'Una imagen supera el peso recomendado para su sección. Vuelve a optimizarla antes de publicar.',
				{
					reason: 'asset_role_weight_exceeded',
					assetId: asset.id,
					path,
					role,
					maxBytes,
					fileSize: asset.fileSize,
				},
			);
		}
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

function throwVisualResolutionError(
	invitationId: string,
	assetSlug: string | undefined,
	stage: 'preflight' | 'publish',
): never {
	console.warn('Invitation publication visual asset resolution failed', {
		invitationId,
		assetSlug: assetSlug || null,
		catalog: 'event-asset-registry',
		stage,
	});
	throw new ApiError(
		422,
		'bad_request',
		'La configuración visual de esta invitación no es válida. No se encontraron los recursos gráficos asociados.',
		{
			section: 'visual',
			assetSlug: assetSlug || null,
			catalog: 'event-asset-registry',
			stage,
		},
	);
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
		{ featuredImage?: { type?: string; key?: string } } | undefined;
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
		{ items?: Array<{ image?: { type?: string; key?: string } }> } | undefined;
	if (gallery?.items) {
		gallery.items.forEach((item, index) => {
			tryAddAssetRef(refs, `gallery.items[${index}].image`, item?.image);
		});
	}

	const interludes = content.interludes as
		Array<{ image?: { type?: string; key?: string } }> | undefined;
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
	context: { assetSlug: string; invitationId: string; stage: 'preflight' | 'publish' },
): void {
	const refs = collectPublishedAssetRefs(publishedContent);
	if (refs.length === 0) return;
	if (!isValidEvent(context.assetSlug)) {
		throwVisualResolutionError(context.invitationId, context.assetSlug, context.stage);
	}
	const unresolved: AssetRefEntry[] = [];

	for (const ref of refs) {
		if (isEventAssetKey(ref.key) && !getEventAsset(context.assetSlug, ref.key)) {
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
	if (content.countdown === undefined) {
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

export async function publishDraft(
	invitationId: string,
	preflight?: PublishPreflightInput,
	commandContext?: InvitationMutationCommandContext,
): Promise<PublishResult> {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'Invitation not found.');
	}

	const draft = await findDraftByInvitationId(invitationId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontró un borrador para esta invitación.');
	}

	if (draft.status !== 'draft' && preflight) {
		const replayed = await replayAtomicPublication({
			invitationId,
			draftId: draft.id,
			expectedDraftUpdatedAt: preflight.draftRevision,
			expectedPublishedVersion: preflight.publishedVersion,
			publicMetadataHash: preflight.publicMetadataHash,
			projectionHash: preflight.projectionHash,
			idempotencyKey: preflight.idempotencyKey,
		});
		if (commandContext) {
			await ensurePartialMutationParent({
				context: commandContext,
				invitationId,
				commandKind: 'publish_invitation',
				completedSteps: ['publication_committed'],
				result: { publishedVersion: replayed.publishedContent.version },
			});
		}
		const replayContext = commandContext
			? {
					...commandContext,
					operationId: randomUUID(),
					retryOfOperationId: commandContext.operationId,
				}
			: undefined;
		return finalizePublicationProvenance({
			invitationId,
			result: replayed,
			context: replayContext,
			replayed: true,
		});
	}

	if (draft.status !== 'draft') {
		throw new ApiError(
			422,
			'invalid_draft_status',
			'Solo se puede publicar un borrador en estado "draft". Estado actual: ' + draft.status,
		);
	}

	const priorPublished = await findPublishedByInvitationId(invitationId);
	const { assetSlug, publishSlug, resolvedTheme, snapshot, demoContent } =
		await resolvePublicationValidationContext(invitation, priorPublished, 'publish');

	const { publicationProjection, publishedContent } = await validatePublication(invitationId, {
		invitation,
		draft,
		priorPublished,
		assetSlug,
		resolvedTheme,
		snapshot,
		demoContent,
		stage: 'publish',
	});

	const reviewedPreflight: PublishPreflightInput = preflight ?? {
		draftRevision: draft.updatedAt,
		publishedVersion: priorPublished?.version ?? null,
		publicMetadataHash: hashPublicMetadata(invitation, priorPublished?.content),
		projectionHash: hashPublicationProjection(publicationProjection),
		idempotencyKey: randomUUID(),
	};
	if (hashPublicationProjection(publicationProjection) !== reviewedPreflight.projectionHash) {
		throw new ApiError(
			409,
			'conflict',
			'La publicación cambió desde que la revisaste. Revisa los cambios más recientes antes de publicar.',
		);
	}

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

	const result = await commitAtomicPublication({
		invitationId,
		draftId: draft.id,
		expectedDraftUpdatedAt: reviewedPreflight.draftRevision,
		expectedPublishedVersion: reviewedPreflight.publishedVersion,
		publicMetadataHash: reviewedPreflight.publicMetadataHash,
		projectionHash: reviewedPreflight.projectionHash,
		idempotencyKey: reviewedPreflight.idempotencyKey,
		slug: publishSlug,
		eventType: invitation.eventType,
		isDemo: invitation.kind === 'demo',
		content: publishedContent,
	});

	return finalizePublicationProvenance({
		invitationId,
		result,
		context: commandContext,
	});
}
