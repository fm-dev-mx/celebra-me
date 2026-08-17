/**
 * Storage Provider Abstraction.
 *
 * Provides a unified contract for storing and resolving invitation assets:
 * - Local (dev-local): Supabase Storage local (http://127.0.0.1:54321 / invitation-assets)
 * - Preview / Production: Cloudinary (https://res.cloudinary.com/...)
 */

import {
	DEFAULT_BUCKET,
	deleteFromStorage,
	getPublicUrl,
	uploadToStorage,
} from '@/lib/intake/storage';
import {
	buildCloudinaryDeliveryUrl,
	uploadOrReconcileCloudinaryAsset,
} from '@/lib/intake/services/cloudinary-assets';
import { isDevEnvironment } from '@/lib/environment';
import { getEnv } from '@/lib/server/env';
import type { AssetDeliverySource } from '@/lib/intake/services/asset-delivery';

export interface StorageUploadInput {
	invitationId: string;
	eventType: string;
	slug: string;
	key: string;
	displayName: string;
	defaultAltText?: string;
	blob: Blob;
	mimeType: string;
	width: number;
	height: number;
	fileSize: number;
	validationVersion: number;
	originalMimeType: string;
	originalFileSize: number;
	sha256: string;
	dryRun?: boolean;
}

export interface StoredAssetResult {
	provider: 'supabase' | 'cloudinary';
	bucket: string;
	storagePath: string;
	providerPublicId?: string;
	providerVersion?: string;
	secureUrl?: string;
	width: number;
	height: number;
	fileSize: number;
	mimeType: string;
	sha256: string;
	metadata: Record<string, unknown>;
	deliveryUrl: string;
}

export interface StorageProvider {
	readonly providerName: 'supabase' | 'cloudinary';
	uploadAsset(input: StorageUploadInput): Promise<StoredAssetResult>;
	resolveDeliveryUrl(asset: AssetDeliverySource): string;
	deleteAsset(storagePath: string, bucket?: string): Promise<void>;
}

export class SupabaseLocalStorageProvider implements StorageProvider {
	readonly providerName = 'supabase' as const;

	async uploadAsset(input: StorageUploadInput): Promise<StoredAssetResult> {
		const shaPrefix = input.sha256.slice(0, 12);
		const sanitizedKey = input.key.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
		const storagePath = `invitations/${input.invitationId}/${sanitizedKey}-${shaPrefix}.webp`;

		if (input.dryRun) {
			return {
				provider: 'supabase',
				bucket: DEFAULT_BUCKET,
				storagePath,
				width: input.width,
				height: input.height,
				fileSize: input.fileSize,
				mimeType: input.mimeType,
				sha256: input.sha256,
				metadata: { dryRun: true },
				deliveryUrl: getPublicUrl(DEFAULT_BUCKET, storagePath),
			};
		}

		const deliveryUrl = await uploadToStorage(
			DEFAULT_BUCKET,
			storagePath,
			input.blob,
			input.mimeType,
		);

		return {
			provider: 'supabase',
			bucket: DEFAULT_BUCKET,
			storagePath,
			width: input.width,
			height: input.height,
			fileSize: input.fileSize,
			mimeType: input.mimeType,
			sha256: input.sha256,
			metadata: {
				storage_provider: 'supabase_local',
				uploaded_at: new Date().toISOString(),
			},
			deliveryUrl,
		};
	}

	resolveDeliveryUrl(asset: AssetDeliverySource): string {
		const bucket = asset.bucket?.trim() || DEFAULT_BUCKET;
		const storagePath = asset.storagePath?.trim() || asset.providerPublicId?.trim() || '';
		return getPublicUrl(bucket, storagePath);
	}

	async deleteAsset(storagePath: string, bucket?: string): Promise<void> {
		await deleteFromStorage(bucket || DEFAULT_BUCKET, storagePath);
	}
}

async function extractBytes(blob: Blob): Promise<Uint8Array> {
	if (typeof blob.arrayBuffer === 'function') {
		return new Uint8Array(await blob.arrayBuffer());
	}
	if (typeof (blob as unknown as { bytes: () => Promise<Uint8Array> }).bytes === 'function') {
		return await (blob as unknown as { bytes: () => Promise<Uint8Array> }).bytes();
	}
	if (typeof blob.text === 'function') {
		const buffer = Buffer.from(await blob.text());
		return new Uint8Array(buffer);
	}
	const internalBuffer = (blob as unknown as { _buffer?: Buffer })._buffer;
	if (internalBuffer && Buffer.isBuffer(internalBuffer)) {
		return new Uint8Array(internalBuffer);
	}
	if (typeof FileReader !== 'undefined') {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const buffer = reader.result as ArrayBuffer;
				resolve(new Uint8Array(buffer));
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(blob);
		});
	}
	return new Uint8Array();
}

export class CloudinaryStorageProvider implements StorageProvider {
	readonly providerName = 'cloudinary' as const;

	async uploadAsset(input: StorageUploadInput): Promise<StoredAssetResult> {
		const bytes = await extractBytes(input.blob);

		const uploaded = await uploadOrReconcileCloudinaryAsset({
			eventType: input.eventType,
			slug: input.slug,
			key: input.key,
			displayName: input.displayName,
			alt: input.defaultAltText ?? input.displayName,
			bytes,
			sha256: input.sha256,
			mimeType: input.mimeType,
			width: input.width,
			height: input.height,
			dryRun: input.dryRun,
		});

		return {
			provider: 'cloudinary',
			bucket: DEFAULT_BUCKET,
			storagePath: uploaded.publicId,
			providerPublicId: uploaded.publicId,
			providerVersion: uploaded.version,
			secureUrl: uploaded.secureUrl,
			width: uploaded.width,
			height: uploaded.height,
			fileSize: uploaded.bytes,
			mimeType: input.mimeType,
			sha256: input.sha256,
			metadata: uploaded.metadata,
			deliveryUrl: uploaded.secureUrl,
		};
	}

	resolveDeliveryUrl(asset: AssetDeliverySource): string {
		const secure = asset.secureUrl?.trim();
		if (secure && /^https?:\/\//i.test(secure)) return secure;

		const publicId = (asset.providerPublicId ?? asset.storagePath)?.trim();
		if (!publicId) return '';

		const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || '';
		return buildCloudinaryDeliveryUrl(cloudName, publicId);
	}

	async deleteAsset(): Promise<void> {
		// Soft-delete policy: Cloudinary binaries are preserved for audit/history.
	}
}

export function resolveEffectiveTarget(targetEnv?: string): 'local' | 'preview' | 'production' {
	if (targetEnv === 'local' || targetEnv === 'preview' || targetEnv === 'production') {
		return targetEnv;
	}

	const vercelEnv = getEnv('VERCEL_ENV').trim().toLowerCase();
	if (vercelEnv === 'production') return 'production';
	if (vercelEnv === 'preview') return 'preview';

	const celebraTarget = getEnv('CELEBRA_RUNTIME_TARGET').trim().toLowerCase();
	if (celebraTarget === 'preview') return 'preview';
	if (celebraTarget === 'production') return 'production';
	if (celebraTarget === 'local') return 'local';

	if (isDevEnvironment()) return 'local';
	return 'local';
}

export function getStorageProvider(targetEnv?: string): StorageProvider {
	const effective = resolveEffectiveTarget(targetEnv);
	if (effective === 'local') {
		return new SupabaseLocalStorageProvider();
	}
	return new CloudinaryStorageProvider();
}
