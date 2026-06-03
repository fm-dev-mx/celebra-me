import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	createAsset,
	findAssetsByInvitationId,
	findAssetById,
	softDeleteAsset,
} from '@/lib/intake/repositories/asset.repository';
import { uploadToStorage, getPublicUrl, DEFAULT_BUCKET } from '@/lib/intake/storage';
import {
	collectAssetUsage,
	collectAssetUsagesByInvitation,
} from '@/lib/intake/services/asset-usage.service';
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

export interface AssetWithUsage extends InvitationAsset {
	src: string;
	usage: {
		usedInDraft: boolean;
		usedInPublished: boolean;
		draftSectionRefs: string[];
		publishedSectionRefs: string[];
	};
}

export async function listAssets(invitationId: string): Promise<AssetWithUsage[]> {
	const assets = await findAssetsByInvitationId(invitationId);
	const usageList = await collectAssetUsagesByInvitation(invitationId);
	const usageByAssetId = new Map(usageList.map((u) => [u.assetId, u]));

	return assets.map((asset) => {
		const usage = usageByAssetId.get(asset.id);
		const src = getPublicUrl(asset.bucket, asset.storagePath);
		return {
			...asset,
			src,
			usage: {
				usedInDraft: usage?.usedInDraft ?? false,
				usedInPublished: usage?.usedInPublished ?? false,
				draftSectionRefs: usage?.draftRefs.map((r) => r.path) ?? [],
				publishedSectionRefs: usage?.publishedRefs.map((r) => r.path) ?? [],
			},
		};
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
		const sections = [
			...usage.draftRefs.map((r) => r.section),
			...usage.publishedRefs.map((r) => r.section),
		];
		const uniqueSections = [...new Set(sections)];
		throw new ApiError(
			409,
			'conflict',
			`No se puede eliminar: la imagen está siendo utilizada en las siguientes secciones: ${uniqueSections.join(', ')}.`,
		);
	}

	// Soft-delete only. Storage objects are NOT deleted — they may be referenced
	// by published snapshots that still contain the frozen URL.
	await softDeleteAsset(assetId);
}
