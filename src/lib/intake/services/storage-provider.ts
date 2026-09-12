/**
 * Storage Provider Abstraction.
 *
 * Provides a unified contract for storing and resolving invitation assets:
 * - Local (dev-local): Supabase Storage local (http://127.0.0.1:54321 / invitation-assets)
 * - Preview / Production: Cloudinary (https://res.cloudinary.com/...)
 */

import {
	DEFAULT_BUCKET,
	getPublicUrl,
	uploadToStorage,
} from '@/lib/intake/storage';
import {
	uploadOrReconcileCloudinaryAsset,
} from '@/lib/intake/services/cloudinary-assets';
import { getEnv } from '@/lib/server/env';

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

}

async function extractBytes(blob: Blob): Promise<Uint8Array> {
	if (typeof blob.arrayBuffer === 'function') {
		return new Uint8Array(await blob.arrayBuffer());
	}
	if (typeof (blob as unknown as { bytes: () => Promise<Uint8Array> }).bytes === 'function') {
		return await (blob as unknown as { bytes: () => Promise<Uint8Array> }).bytes();
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
	throw new Error('Unsupported blob: binary extraction is not available.');
}

export class CloudinaryStorageProvider implements StorageProvider {
	readonly providerName = 'cloudinary' as const;

	constructor(private readonly targetEnvironment: 'preview' | 'production') {}

	async uploadAsset(input: StorageUploadInput): Promise<StoredAssetResult> {
		const bytes = await extractBytes(input.blob);

		const uploaded = await uploadOrReconcileCloudinaryAsset({
			targetEnvironment: this.targetEnvironment,
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

	return 'local';
}

export function getStorageProvider(targetEnv?: string): StorageProvider {
	const effective = resolveEffectiveTarget(targetEnv);
	if (effective === 'local') {
		return new SupabaseLocalStorageProvider();
	}
	return new CloudinaryStorageProvider(effective);
}
