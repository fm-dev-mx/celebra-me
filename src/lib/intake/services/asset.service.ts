import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	createAsset,
	findAssetsByInvitationId,
	findArchivedAssetsByInvitationId,
	findAssetById,
	updateAsset,
	restoreAsset as restoreAssetRepo,
	softDeleteAsset,
} from '@/lib/intake/repositories/asset.repository';
import { DEFAULT_BUCKET } from '@/lib/intake/storage';
import {
	resolveAssetDeliveryUrl,
} from '@/lib/intake/services/asset-delivery';
import { uploadOrReconcileCloudinaryAsset } from '@/lib/intake/services/cloudinary-assets';
import {
	collectAssetUsage,
	collectAssetUsagesByInvitation,
} from '@/lib/intake/services/asset-usage.service';
import { getDemoPresetAssets } from '@/lib/intake/services/demo-asset.service';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';
import { isEventAssetKey, getEventAsset, isValidEvent } from '@/lib/assets/asset-registry';
import type { InvitationAsset } from '@/lib/intake/types';
import { normalizeInvitationImage } from '@/lib/intake/services/asset-policy';

function deliverySourceFromAsset(asset: InvitationAsset) {
	return {
		id: asset.id,
		provider: asset.provider ?? 'supabase',
		bucket: asset.bucket,
		storagePath: asset.storagePath,
		providerPublicId: asset.providerPublicId,
		secureUrl: asset.secureUrl,
	};
}

export interface UploadAssetResult {
	asset: InvitationAsset;
	src: string;
}

async function persistCloudinaryInvitationImage(input: {
	invitationId: string;
	eventType: string;
	slug: string;
	key: string;
	displayName: string;
	defaultAltText?: string;
	normalized: {
		blob: Blob;
		mimeType: string;
		width: number;
		height: number;
		fileSize: number;
		validationVersion: number;
		originalMimeType: string;
		originalFileSize: number;
	};
}): Promise<UploadAssetResult> {
	const bytes = new Uint8Array(await input.normalized.blob.arrayBuffer());
	const sha256 = createHash('sha256').update(bytes).digest('hex');

	let uploaded;
	try {
		uploaded = await uploadOrReconcileCloudinaryAsset({
			eventType: input.eventType,
			slug: input.slug,
			key: input.key,
			displayName: input.displayName,
			alt: input.defaultAltText ?? input.displayName,
			bytes,
			sha256,
			mimeType: input.normalized.mimeType,
			width: input.normalized.width,
			height: input.normalized.height,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('Stop before mutation')) {
			throw new ApiError(502, 'config_error', 'La carga de imágenes no está disponible en este momento.');
		}
		throw new ApiError(502, 'internal_error', 'No se pudo subir la imagen. Intenta nuevamente.');
	}

	const asset = await createAsset({
		invitationId: input.invitationId,
		displayName: input.displayName,
		defaultAltText: input.defaultAltText,
		bucket: DEFAULT_BUCKET,
		storagePath: uploaded.publicId,
		mimeType: input.normalized.mimeType,
		width: uploaded.width,
		height: uploaded.height,
		fileSize: uploaded.bytes,
		validationVersion: input.normalized.validationVersion,
		originalMimeType: input.normalized.originalMimeType,
		originalFileSize: input.normalized.originalFileSize,
		provider: 'cloudinary',
		providerPublicId: uploaded.publicId,
		secureUrl: uploaded.secureUrl,
		sha256,
	});

	return { asset, src: resolveAssetDeliveryUrl(deliverySourceFromAsset(asset)) };
}

export async function uploadAsset(
	invitationId: string,
	file: Blob,
	mimeType: string,
	displayName?: string,
	defaultAltText?: string,
): Promise<UploadAssetResult> {
	const invitation = await findInvitationById(invitationId);
	if (!invitation?.slug) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}

	const normalized = await normalizeInvitationImage(file, mimeType);
	const assetId = randomUUID();
	return persistCloudinaryInvitationImage({
		invitationId,
		eventType: invitation.eventType,
		slug: invitation.slug,
		key: `library-${assetId}`,
		displayName: displayName ?? `Imagen ${assetId.slice(0, 8)}`,
		defaultAltText,
		normalized,
	});
}

export interface AssetUsageInfo {
	usedInDraft: boolean;
	usedInPublished: boolean;
	draftSectionRefs: string[];
	publishedSectionRefs: string[];
}

export interface AssetWithUsage extends InvitationAsset {
	src: string;
	isDemo?: false;
	usage: AssetUsageInfo;
}

export interface DemoAssetWithUsage {
	id: string;
	invitationId?: string;
	displayName: string;
	src: string;
	isDemo: true;
	demoKey: string;
	width?: number;
	height?: number;
	mimeType: string;
	usage: AssetUsageInfo;
}

export type LibraryAssetItem = AssetWithUsage | DemoAssetWithUsage;

const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_ALT_TEXT_LENGTH = 500;

export async function restoreAsset(
	assetId: string,
	invitationId: string,
): Promise<InvitationAsset> {
	const asset = await findAssetById(assetId);
	if (!asset || asset.invitationId !== invitationId) {
		throw new ApiError(404, 'not_found', 'No se encontró el recurso solicitado.');
	}
	if (!asset.deletedAt) {
		throw new ApiError(400, 'bad_request', 'El recurso no está archivado.');
	}
	return restoreAssetRepo(assetId);
}

export async function updateAssetMetadata(
	assetId: string,
	input: { displayName?: string; defaultAltText?: string },
	invitationId?: string,
): Promise<InvitationAsset> {
	const asset = await findAssetById(assetId);
	if (!asset) {
		throw new ApiError(404, 'not_found', 'No se encontró el recurso solicitado.');
	}

	if (invitationId && asset.invitationId !== invitationId) {
		throw new ApiError(404, 'not_found', 'No se encontró el recurso solicitado.');
	}

	if (asset.deletedAt) {
		throw new ApiError(404, 'not_found', 'El recurso solicitado ha sido eliminado.');
	}

	const normalized: { displayName?: string; defaultAltText?: string } = {};

	if (input.displayName !== undefined) {
		const trimmed = input.displayName.trim();
		if (trimmed.length === 0) {
			throw new ApiError(400, 'bad_request', 'El nombre visible no puede estar vacío.');
		}
		if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
			throw new ApiError(
				400,
				'bad_request',
				`El nombre visible no puede exceder ${MAX_DISPLAY_NAME_LENGTH} caracteres.`,
			);
		}
		normalized.displayName = trimmed;
	}

	if (input.defaultAltText !== undefined) {
		const trimmed = input.defaultAltText.trim();
		if (trimmed.length > MAX_ALT_TEXT_LENGTH) {
			throw new ApiError(
				400,
				'bad_request',
				`El texto alternativo no puede exceder ${MAX_ALT_TEXT_LENGTH} caracteres.`,
			);
		}
		normalized.defaultAltText = trimmed;
	}

	return updateAsset(assetId, normalized);
}

export async function listAssets(
	invitationId: string,
	previewSlug?: string,
	filter?: 'active' | 'archived',
): Promise<LibraryAssetItem[]> {
	if (filter === 'archived') {
		const archivedAssets = await findArchivedAssetsByInvitationId(invitationId);
		return archivedAssets.map((asset) => {
			const src = resolveAssetDeliveryUrl(deliverySourceFromAsset(asset));
			return {
				...asset,
				src,
				isDemo: false,
				usage: {
					usedInDraft: false,
					usedInPublished: false,
					draftSectionRefs: [],
					publishedSectionRefs: [],
				},
			};
		});
	}

	const [assets, usageList] = await Promise.all([
		findAssetsByInvitationId(invitationId),
		collectAssetUsagesByInvitation(invitationId),
	]);
	const usageByAssetId = new Map(usageList.map((u) => [u.assetId, u]));

	const uploaded: AssetWithUsage[] = assets.map((asset) => {
		const usage = usageByAssetId.get(asset.id);
		const src = resolveAssetDeliveryUrl(deliverySourceFromAsset(asset));
		return {
			...asset,
			src,
			isDemo: false,
			usage: {
				usedInDraft: usage?.usedInDraft ?? false,
				usedInPublished: usage?.usedInPublished ?? false,
				draftSectionRefs: usage?.draftRefs.map((r) => r.path) ?? [],
				publishedSectionRefs: usage?.publishedRefs.map((r) => r.path) ?? [],
			},
		};
	});

	if (!previewSlug) return uploaded;

	const demoAssets = getDemoPresetAssets(previewSlug);
	const demo: DemoAssetWithUsage[] = demoAssets.map((entry) => {
		const usage = usageByAssetId.get(entry.key);
		return {
			id: `demo:${previewSlug}:${entry.key}`,
			displayName: entry.displayName,
			src: entry.src,
			isDemo: true,
			demoKey: entry.key,
			width: entry.width,
			height: entry.height,
			mimeType: 'image/webp',
			usage: {
				usedInDraft: usage?.usedInDraft ?? false,
				usedInPublished: usage?.usedInPublished ?? false,
				draftSectionRefs: usage?.draftRefs.map((r) => r.path) ?? [],
				publishedSectionRefs: usage?.publishedRefs.map((r) => r.path) ?? [],
			},
		};
	});

	return [...uploaded, ...demo];
}

export async function importDemoAsset(
	invitationId: string,
	demoKey: string,
	requestUrl?: string,
): Promise<UploadAssetResult> {
	if (!isEventAssetKey(demoKey)) {
		throw new ApiError(400, 'bad_request', 'La clave de imagen de demo no es válida.');
	}

	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'No se encontró la invitación.');
	}

	const published = await findPublishedByInvitationId(invitationId);
	const assetSlug = resolveAssetSlug(invitation, published?.content);

	if (!isValidEvent(assetSlug)) {
		throw new ApiError(
			422,
			'bad_request',
			'La invitación no tiene configuración visual asociada.',
		);
	}

	const metadata = getEventAsset(assetSlug, demoKey);
	if (!metadata) {
		throw new ApiError(
			404,
			'not_found',
			`No se encontró la imagen de demo "${demoKey}" para esta invitación.`,
		);
	}

	const deliverySlug = invitation.slug ?? assetSlug;
	if (!deliverySlug) {
		throw new ApiError(422, 'bad_request', 'La invitación no tiene una ruta pública.');
	}

	const assetId = randomUUID();

	let imageSrc = metadata.src;
	if (typeof imageSrc === 'string' && imageSrc.startsWith('/') && requestUrl) {
		imageSrc = new URL(imageSrc, requestUrl).toString();
	}

	const response = await fetch(imageSrc as string);
	if (!response.ok) {
		throw new ApiError(
			502,
			'internal_error',
			'No se pudo leer la imagen de demo para copiarla a la biblioteca.',
		);
	}

	const blob = await response.blob();
	const normalized = await normalizeInvitationImage(
		blob,
		response.headers.get('content-type') || blob.type || `image/${metadata.format ?? 'webp'}`,
	);

	return persistCloudinaryInvitationImage({
		invitationId,
		eventType: invitation.eventType,
		slug: deliverySlug,
		key: `demo-${demoKey}-${assetId.slice(0, 8)}`,
		displayName: demoKey,
		normalized,
	});
}

export async function deleteAsset(invitationId: string, assetId: string): Promise<void> {
	const asset = await findAssetById(assetId);
	if (!asset || asset.invitationId !== invitationId) {
		throw new ApiError(404, 'not_found', 'No se encontró el recurso solicitado.');
	}

	if (asset.deletedAt) {
		throw new ApiError(404, 'not_found', 'El recurso ya fue eliminado.');
	}

	const usage = await collectAssetUsage(invitationId, assetId);

	if (usage.usedInDraft || usage.usedInPublished) {
		const refs = [
			...usage.draftRefs.map((r) => r.path),
			...usage.publishedRefs.map((r) => r.path),
		];
		throw new ApiError(
			409,
			'conflict',
			`No se puede eliminar: la imagen está siendo utilizada en las siguientes secciones: ${[...new Set(refs)].join(', ')}.`,
			{
				sectionRefs: refs,
				usedInDraft: usage.usedInDraft,
				usedInPublished: usage.usedInPublished,
			},
		);
	}

	// Soft-delete only. Storage objects are NOT deleted — they may be referenced
	// by published snapshots that still contain the frozen URL.
	await softDeleteAsset(assetId);
}
