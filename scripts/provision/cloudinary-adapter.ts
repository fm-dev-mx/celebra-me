/**
 * CLI wrapper for Cloudinary invitation-image uploads.
 * Hydrates process.env from local files, then delegates to the shared server module.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnvContent } from '../db/db-workflow-lib.ts';
import {
	uploadOrReconcileCloudinaryAsset as uploadOrReconcileFromEnv,
	verifyCloudinaryAsset as verifyCloudinaryAssetFromEnv,
	readVerifiedCloudinaryAsset,
	verifyCloudinaryDelivery,
	readCloudinaryQuota,
	getCloudinaryErrorStatus,
	type CloudinaryAssetUploadInput,
	type CloudinaryAssetVerificationInput,
	type CloudinaryAssetResult,
} from '../../src/lib/intake/services/cloudinary-assets.ts';
import { CloudinaryQuota } from './cloudinary-quota.ts';

/** Canonical migration session: quota and fresh binary evidence live only in this operation. */
export function createCloudinaryMigrationSession() {
	hydrateCloudinaryEnvFromFiles();
	const quota = new CloudinaryQuota(readCloudinaryQuota);
	return {
		quota,
		verifySource: (input: CloudinaryAssetVerificationInput) =>
			readVerifiedCloudinaryAsset(input, quota),
		async copy(input: CloudinaryAssetUploadInput) {
			try {
				const asset = await uploadOrReconcileFromEnv(input, quota);
				await verifyCloudinaryDelivery(
					{
						publicId: asset.publicId,
						sha256: input.sha256,
						mimeType: input.mimeType,
						width: asset.width,
						height: asset.height,
					},
					asset.secureUrl,
				);
				return asset;
			} catch (error) {
				quota.failed(getCloudinaryErrorStatus(error));
				throw error;
			}
		},
	};
}

export {
	buildCloudinaryDeliveryUrl,
	buildCloudinaryOgImageUrl,
	buildCloudinaryPublicId,
	classifyCloudinaryPublicIdEnvironment,
	assertCloudinaryPublicIdEnvironment,
	assertCloudinaryMutationTarget,
	getCloudinaryErrorStatus,
} from '../../src/lib/intake/services/cloudinary-assets.ts';

const FILE_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;
type CloudinaryEnvKey = (typeof FILE_KEYS)[number];

export function hydrateCloudinaryEnvFromFiles(
	options: {
		cwd?: string;
		env?: NodeJS.ProcessEnv;
		keys?: readonly CloudinaryEnvKey[];
	} = {},
): NodeJS.ProcessEnv {
	const env = options.env ?? process.env;
	const keys = options.keys ?? FILE_KEYS;
	const missing = keys.filter((key) => !env[key]?.trim());
	if (missing.length === 0) return env;

	const envCandidates = ['.env.local', '.env', '.secrets/cloudinary.env'];
	for (const candidate of envCandidates) {
		const fullPath = resolve(options.cwd ?? process.cwd(), candidate);
		if (!existsSync(fullPath)) continue;
		const parsed = parseEnvContent(readFileSync(fullPath, 'utf8'));
		for (const key of missing) {
			if (!env[key]?.trim() && parsed[key]?.trim()) {
				env[key] = parsed[key];
			}
		}
	}
	return env;
}

export async function uploadOrReconcileCloudinaryAsset(
	input: CloudinaryAssetUploadInput,
): Promise<CloudinaryAssetResult> {
	hydrateCloudinaryEnvFromFiles();
	return uploadOrReconcileFromEnv(input);
}

/** Read-only Cloudinary verification used before a content-only release preserves an asset. */
export async function verifyCloudinaryAsset(
	input: CloudinaryAssetVerificationInput,
): Promise<CloudinaryAssetResult> {
	hydrateCloudinaryEnvFromFiles();
	return verifyCloudinaryAssetFromEnv(input);
}
