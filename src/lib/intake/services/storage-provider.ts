/**
 * Storage Provider Abstraction.
 *
 * Provides a unified contract for storing and resolving invitation assets:
 * - Local (dev-local): Supabase Storage local (http://127.0.0.1:54321 / invitation-assets)
 * - Preview / Production on the Cloudflare Worker: R2 (https://media.celebra-me.com/...)
 */

import { DEFAULT_BUCKET, getPublicUrl, uploadToStorage } from '@/lib/intake/storage';
import {
	R2_INVITATION_MEDIA,
	buildR2ObjectKey,
	buildR2PublicUrl,
	buildR2VariantObjectKey,
	getInvitationMediaBucket,
	putR2ImageVariantIfMissing,
	putR2InvitationMedia,
	type InvitationMediaBucket,
} from '@/lib/intake/services/r2-invitation-media';
import { resolveImageTransformer } from '@/lib/images/image-transformer-provider';
import {
	RESPONSIVE_IMAGE_WIDTHS,
	encodeResponsiveVariants,
	type ResponsiveImageVariant,
} from '@/lib/images/responsive-variants';
import { resolveDeployEnvironment } from '@/lib/server/deploy-identity';
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
	provider: 'supabase' | 'r2';
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
	readonly providerName: 'supabase' | 'r2';
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

export class R2StorageProvider implements StorageProvider {
	readonly providerName = 'r2' as const;

	constructor(
		private readonly targetEnvironment: 'preview' | 'production',
		private readonly bucket: InvitationMediaBucket,
		private readonly encodeVariants: (
			bytes: Uint8Array,
		) => Promise<ResponsiveImageVariant[]> = async (bytes) =>
			encodeResponsiveVariants(await resolveImageTransformer(), bytes),
	) {}

	/** A re-upload of known bytes skips the encoder when every variant is already stored. */
	private async hasAllVariants(objectKey: string): Promise<boolean> {
		const heads = await Promise.all(
			RESPONSIVE_IMAGE_WIDTHS.map((width) =>
				this.bucket.head(buildR2VariantObjectKey(objectKey, width)),
			),
		);
		return heads.every(Boolean);
	}

	async uploadAsset(input: StorageUploadInput): Promise<StoredAssetResult> {
		const objectKey = buildR2ObjectKey({
			eventType: input.eventType,
			slug: input.slug,
			key: input.key,
			sha256: input.sha256,
			mimeType: input.mimeType,
		});
		const result = {
			provider: 'r2' as const,
			bucket: R2_INVITATION_MEDIA[this.targetEnvironment].bucket,
			storagePath: objectKey,
			providerPublicId: objectKey,
			providerVersion: input.sha256,
			width: input.width,
			height: input.height,
			fileSize: input.fileSize,
			mimeType: input.mimeType,
			sha256: input.sha256,
		};
		if (input.dryRun) {
			const url = buildR2PublicUrl(this.targetEnvironment, objectKey);
			return { ...result, secureUrl: url, deliveryUrl: url, metadata: { dryRun: true } };
		}
		const bytes = await extractBytes(input.blob);
		const { url, reused } = await putR2InvitationMedia(this.bucket, {
			target: this.targetEnvironment,
			objectKey,
			bytes,
			mimeType: input.mimeType,
			sha256: input.sha256,
		});
		// Width variants are written before the URL is returned, so no published image lacks them.
		if (input.mimeType.startsWith('image/') && !(await this.hasAllVariants(objectKey))) {
			for (const variant of await this.encodeVariants(bytes)) {
				await putR2ImageVariantIfMissing(this.bucket, {
					variantKey: buildR2VariantObjectKey(objectKey, variant.width),
					bytes: variant.data,
					sourceSha256: input.sha256,
				});
			}
		}
		return {
			...result,
			secureUrl: url,
			deliveryUrl: url,
			metadata: { storage_provider: 'r2', reused, uploaded_at: new Date().toISOString() },
		};
	}
}

export function resolveEffectiveTarget(targetEnv?: string): 'local' | 'preview' | 'production' {
	if (targetEnv === 'local' || targetEnv === 'preview' || targetEnv === 'production') {
		return targetEnv;
	}

	// Hosted bundles answer their declared identity; an ambiguous bundle throws instead
	// of silently writing to local storage.
	const deployEnvironment = resolveDeployEnvironment();
	if (deployEnvironment !== 'local') return deployEnvironment;

	const celebraTarget = getEnv('CELEBRA_RUNTIME_TARGET').trim().toLowerCase();
	if (celebraTarget === 'preview') return 'preview';
	if (celebraTarget === 'local') return 'local';

	return 'local';
}

export function getStorageProvider(targetEnv?: string): StorageProvider {
	const effective = resolveEffectiveTarget(targetEnv);
	if (effective === 'local') {
		return new SupabaseLocalStorageProvider();
	}
	const bucket = getInvitationMediaBucket();
	if (!bucket)
		throw new Error(
			`Invitation media uploads on ${effective} need the INVITATION_MEDIA R2 binding.`,
		);
	return new R2StorageProvider(effective, bucket);
}
