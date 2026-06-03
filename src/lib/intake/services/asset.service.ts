import { randomUUID } from 'node:crypto';
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
import { uploadToStorage, getPublicUrl, DEFAULT_BUCKET } from '@/lib/intake/storage';
import {
	collectAssetUsage,
	collectAssetUsagesByInvitation,
} from '@/lib/intake/services/asset-usage.service';
import { getDemoPresetAssets } from '@/lib/intake/services/demo-asset.service';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { isEventAssetKey, getEventAsset } from '@/lib/assets/asset-registry';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/intake/constants';
import type { InvitationAsset } from '@/lib/intake/types';

function getExtension(mimeType: string): string {
	const map: Record<string, string> = {
		'image/webp': 'webp',
		'image/jpeg': 'jpg',
		'image/png': 'png',
	};
	return map[mimeType];
}

export interface UploadAssetResult {
	asset: InvitationAsset;
	src: string;
}

export async function uploadAsset(
	invitationId: string,
	file: Blob,
	mimeType: string,
	displayName?: string,
	defaultAltText?: string,
): Promise<UploadAssetResult> {
	if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
		throw new ApiError(
			400,
			'bad_request',
			'Tipo de archivo no soportado. Solo se aceptan imágenes WebP, JPEG y PNG.',
		);
	}

	if (file.size > MAX_FILE_SIZE) {
		throw new ApiError(400, 'bad_request', 'El archivo excede el tamaño máximo de 10 MB.');
	}

	const assetId = randomUUID();
	const ext = getExtension(mimeType);
	const storagePath = `invitations/${invitationId}/original/${assetId}.${ext}`;

	await uploadToStorage(DEFAULT_BUCKET, storagePath, file, mimeType);

	const asset = await createAsset({
		invitationId,
		displayName: displayName ?? `Imagen ${assetId.slice(0, 8)}`,
		defaultAltText,
		bucket: DEFAULT_BUCKET,
		storagePath,
		mimeType,
		fileSize: file.size,
	});

	const src = getPublicUrl(DEFAULT_BUCKET, storagePath);

	return { asset, src };
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
			const src = getPublicUrl(asset.bucket, asset.storagePath);
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
		const src = getPublicUrl(asset.bucket, asset.storagePath);
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

	const previewSlug = invitation.snapshot?.previewSlug;
	if (!previewSlug) {
		throw new ApiError(
			422,
			'bad_request',
			'La invitación no tiene configuración visual asociada.',
		);
	}

	const metadata = getEventAsset(previewSlug, demoKey);
	if (!metadata) {
		throw new ApiError(
			404,
			'not_found',
			`No se encontró la imagen de demo "${demoKey}" para esta invitación.`,
		);
	}

	const ext = metadata.format ?? 'webp';
	const assetId = randomUUID();
	const storagePath = `invitations/${invitationId}/original/${assetId}.${ext}`;

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

	await uploadToStorage(DEFAULT_BUCKET, storagePath, blob, `image/${ext}`);

	const asset = await createAsset({
		invitationId,
		displayName: demoKey,
		bucket: DEFAULT_BUCKET,
		storagePath,
		mimeType: `image/${ext}`,
		width: typeof metadata.width === 'number' ? metadata.width : undefined,
		height: typeof metadata.height === 'number' ? metadata.height : undefined,
		fileSize: blob.size,
	});

	const src = getPublicUrl(DEFAULT_BUCKET, storagePath);

	return { asset, src };
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
