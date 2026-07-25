/**
 * cloudinary-adapter.ts — Managed Invitation Cloudinary Storage Adapter
 *
 * Server-only adapter wrapping the official Cloudinary Node.js SDK for managed invitation asset provisioning.
 * Enforces deterministic immutable public IDs, hash-based reconciliation, collision protection,
 * provider-neutral metadata generation, and transformation URL derivation.
 *
 * Credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are loaded
 * exclusively in local CLI trusted execution contexts and are never printed, logged, or sent to runtime.
 */

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnvContent } from '../db/db-workflow-lib.ts';

export interface CloudinaryConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
}

export interface CloudinaryAssetUploadInput {
	slug: string;
	key: string;
	displayName: string;
	alt: string;
	bytes: Uint8Array;
	sha256: string;
	mimeType: string;
	assetFolder?: string;
	width?: number;
	height?: number;
	dryRun?: boolean;
}

export interface CloudinaryAssetResult {
	provider: 'cloudinary';
	publicId: string;
	version: string;
	secureUrl: string;
	sha256: string;
	width: number;
	height: number;
	bytes: number;
	format: string;
	metadata: Record<string, unknown>;
	action: 'REUSE' | 'UPLOAD';
}

interface CloudinaryResourceData {
	public_id: string;
	version: string | number;
	secure_url?: string;
	width: number;
	height: number;
	bytes: number;
	format: string;
	resource_type: string;
	created_at: string;
	asset_id?: string;
	asset_folder?: string;
	folder?: string;
	context?: {
		custom?: { sha256?: string };
		sha256?: string;
	};
}

let isConfigured = false;

export function resolveCloudinaryConfig(): CloudinaryConfig {
	let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	let apiKey = process.env.CLOUDINARY_API_KEY;
	let apiSecret = process.env.CLOUDINARY_API_SECRET;

	if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
		const envCandidates = ['.env.local', '.env', '.secrets/cloudinary.env'];
		for (const candidate of envCandidates) {
			const fullPath = resolve(process.cwd(), candidate);
			if (existsSync(fullPath)) {
				const parsed = parseEnvContent(readFileSync(fullPath, 'utf8'));
				if (cloudName === undefined) cloudName = parsed.CLOUDINARY_CLOUD_NAME;
				if (apiKey === undefined) apiKey = parsed.CLOUDINARY_API_KEY;
				if (apiSecret === undefined) apiSecret = parsed.CLOUDINARY_API_SECRET;
			}
		}
	}

	return {
		cloudName: cloudName?.trim() || 'celebra-me',
		apiKey: apiKey?.trim() || '',
		apiSecret: apiSecret?.trim() || '',
	};
}

export function initCloudinary(): void {
	if (isConfigured) return;
	const config = resolveCloudinaryConfig();
	if (config.apiKey && config.apiSecret) {
		cloudinary.config({
			cloud_name: config.cloudName,
			api_key: config.apiKey,
			api_secret: config.apiSecret,
			secure: true,
		});
		isConfigured = true;
	}
}

/**
 * Generates an immutable Cloudinary public ID for a managed invitation asset.
 * Shape: xv/<slug>/assets/<semantic-key>-<sha-prefix> (or custom assetFolder)
 * Guaranteed no leading slash or file extension.
 */
export function buildCloudinaryPublicId(
	slug: string,
	key: string,
	sha256: string,
	assetFolder?: string,
): string {
	const shaPrefix = sha256.slice(0, 12);
	const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
	if (assetFolder) {
		const cleanFolder = assetFolder.replace(/^\/+|\/+$/g, '');
		return `${cleanFolder}/${sanitizedKey}-${shaPrefix}`;
	}
	if (slug === 'abril-michelle-becerra-rea') {
		return `xv/${slug}/assets/${sanitizedKey}-${shaPrefix}`;
	}
	return `invitations/${slug}/${sanitizedKey}-${shaPrefix}`;
}

function buildAssetResult(
	resource: CloudinaryResourceData,
	input: CloudinaryAssetUploadInput,
	canonicalSecureUrl: string,
	action: CloudinaryAssetResult['action'],
): CloudinaryAssetResult {
	return {
		provider: 'cloudinary',
		publicId: resource.public_id,
		version: String(resource.version),
		secureUrl: (resource.secure_url ?? canonicalSecureUrl).replace(/\/v\d+\//, '/v1/'),
		sha256: input.sha256,
		width: resource.width,
		height: resource.height,
		bytes: resource.bytes,
		format: resource.format,
		metadata: {
			resource_type: resource.resource_type,
			created_at: resource.created_at,
			asset_id: resource.asset_id,
			asset_folder: resource.asset_folder ?? resource.folder ?? '',
		},
		action,
	};
}

function getCloudinaryErrorStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null || !('http_code' in error)) return undefined;
	return typeof error.http_code === 'number' ? error.http_code : undefined;
}

function isCollisionError(error: unknown): boolean {
	return error instanceof Error && error.message.includes('collision');
}

async function findExistingAsset(
	publicId: string,
	input: CloudinaryAssetUploadInput,
	canonicalSecureUrl: string,
): Promise<CloudinaryAssetResult | null> {
	try {
		const resource = (await cloudinary.api.resource(publicId, {
			context: true,
		})) as CloudinaryResourceData | null;
		if (!resource) return null;

		const existingSha = resource.context?.custom?.sha256 ?? resource.context?.sha256;
		if (existingSha && existingSha !== input.sha256) {
			throw new Error(
				`Cloudinary public ID collision detected for "${publicId}": existing sha256 (${existingSha.slice(0, 12)}…) does not match input sha256 (${input.sha256.slice(0, 12)}…).`,
			);
		}

		return buildAssetResult(resource, input, canonicalSecureUrl, 'REUSE');
	} catch (error: unknown) {
		const statusCode = getCloudinaryErrorStatus(error);
		if (statusCode !== 404 && isCollisionError(error)) throw error;
		return null;
	}
}

function buildPredictedAssetResult(
	publicId: string,
	input: CloudinaryAssetUploadInput,
	canonicalSecureUrl: string,
): CloudinaryAssetResult {
	return {
		provider: 'cloudinary',
		publicId,
		version: '1',
		secureUrl: canonicalSecureUrl,
		sha256: input.sha256,
		width: input.width ?? 1000,
		height: input.height ?? 1000,
		bytes: input.bytes.length,
		format: 'webp',
		metadata: { predicted: true },
		action: 'UPLOAD',
	};
}

function assertCloudinaryCredentials(config: CloudinaryConfig): void {
	if (!config.apiKey || !config.apiSecret || !config.cloudName) {
		throw new Error(
			'Stop before mutation: Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing in the local environment. Please configure them in process.env or .env.local to proceed with upload.',
		);
	}
}

async function uploadCloudinaryAsset(
	publicId: string,
	input: CloudinaryAssetUploadInput,
	canonicalSecureUrl: string,
): Promise<CloudinaryAssetResult> {
	const dataUri = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString('base64')}`;
	const targetFolder =
		input.assetFolder ??
		(input.slug === 'abril-michelle-becerra-rea' ? `xv/${input.slug}/assets` : undefined);

	const uploadResult: UploadApiResponse = await cloudinary.uploader.upload(dataUri, {
		public_id: publicId,
		asset_folder: targetFolder,
		overwrite: false,
		unique_filename: false,
		context: `sha256=${input.sha256}|slug=${input.slug}|key=${input.key}|displayName=${encodeURIComponent(input.displayName)}`,
		tags: ['managed-invitation', input.slug],
	});

	return buildAssetResult(uploadResult, input, canonicalSecureUrl, 'UPLOAD');
}

/**
 * Uploads or reconciles a managed invitation binary on Cloudinary.
 * Guarantees idempotency and prevents binary overwrites/collisions.
 */
export async function uploadOrReconcileCloudinaryAsset(
	input: CloudinaryAssetUploadInput,
): Promise<CloudinaryAssetResult> {
	initCloudinary();
	const config = resolveCloudinaryConfig();

	const publicId = buildCloudinaryPublicId(
		input.slug,
		input.key,
		input.sha256,
		input.assetFolder,
	);
	const canonicalSecureUrl = `https://res.cloudinary.com/${config.cloudName}/image/upload/v1/${publicId}.webp`;

	// 1. Inspect existing Cloudinary resource if present
	const existingResult = await findExistingAsset(publicId, input, canonicalSecureUrl);
	if (existingResult) return existingResult;

	if (input.dryRun) {
		return buildPredictedAssetResult(publicId, input, canonicalSecureUrl);
	}

	assertCloudinaryCredentials(config);

	// 2. Upload binary stream to Cloudinary
	return uploadCloudinaryAsset(publicId, input, canonicalSecureUrl);
}

/**
 * Derives a versioned horizontal 1200x630 OpenGraph transformation URL from a Cloudinary secure_url.
 */
export function buildCloudinaryOgImageUrl(secureUrl: string): string {
	if (!secureUrl.includes('/upload/')) {
		return secureUrl;
	}
	return secureUrl.replace('/upload/', '/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_auto/');
}
