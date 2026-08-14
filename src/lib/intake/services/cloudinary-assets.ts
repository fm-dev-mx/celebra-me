/**
 * Server-only Cloudinary upload/reconcile for invitation images.
 * Astro client islands must not import this module.
 */

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export interface CloudinaryConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
}

export interface CloudinaryAssetUploadInput {
	eventType: string;
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

let configuredSignature = '';

export function resolveCloudinaryConfigFromEnv(): CloudinaryConfig {
	return {
		cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
		apiKey: process.env.CLOUDINARY_API_KEY?.trim() || '',
		apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || '',
	};
}

const PLACEHOLDER_CREDENTIALS = new Set([
	'local-cloudinary-cloud-placeholder',
	'local-cloudinary-api-key-placeholder',
	'local-cloudinary-api-secret-placeholder',
]);

function isUsableCredential(value: string): boolean {
	return Boolean(value) && !PLACEHOLDER_CREDENTIALS.has(value);
}

export function assertCloudinaryCredentials(config: CloudinaryConfig): void {
	if (
		!isUsableCredential(config.apiKey) ||
		!isUsableCredential(config.apiSecret) ||
		!isUsableCredential(config.cloudName)
	) {
		throw new Error(
			'Stop before mutation: Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing. Configure server-only environment values before uploading invitation images.',
		);
	}
}

function initCloudinary(config: CloudinaryConfig): void {
	const signature = `${config.cloudName}:${Boolean(config.apiKey)}:${Boolean(config.apiSecret)}`;
	if (configuredSignature === signature) return;
	if (config.apiKey && config.apiSecret && config.cloudName) {
		cloudinary.config({
			cloud_name: config.cloudName,
			api_key: config.apiKey,
			api_secret: config.apiSecret,
			secure: true,
		});
	}
	configuredSignature = signature;
}

function sanitizePublicIdSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

/**
 * Immutable Cloudinary public ID: {eventType}/{slug}/assets/{key}-{shaPrefix}
 */
export function buildCloudinaryPublicId(input: {
	eventType: string;
	slug: string;
	key: string;
	sha256: string;
	assetFolder?: string;
}): string {
	const shaPrefix = input.sha256.slice(0, 12);
	const sanitizedKey = sanitizePublicIdSegment(input.key);
	if (input.assetFolder) {
		const cleanFolder = input.assetFolder.replace(/^\/+|\/+$/g, '');
		return `${cleanFolder}/${sanitizedKey}-${shaPrefix}`;
	}
	const eventType = sanitizePublicIdSegment(input.eventType);
	const slug = sanitizePublicIdSegment(input.slug);
	return `${eventType}/${slug}/assets/${sanitizedKey}-${shaPrefix}`;
}

export function buildCloudinaryDeliveryUrl(cloudName: string, publicId: string): string {
	const name = cloudName.trim() || 'unconfigured';
	return `https://res.cloudinary.com/${name}/image/upload/v1/${publicId}.webp`;
}

export function buildCloudinaryOgImageUrl(secureUrl: string): string {
	if (!secureUrl.includes('/upload/')) return secureUrl;
	return secureUrl.replace('/upload/', '/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_auto/');
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
		if (isCollisionError(error)) throw error;
		const statusCode = getCloudinaryErrorStatus(error);
		if (statusCode === 404 || input.dryRun) return null;
		throw error;
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

async function uploadCloudinaryAsset(
	publicId: string,
	input: CloudinaryAssetUploadInput,
	canonicalSecureUrl: string,
): Promise<CloudinaryAssetResult> {
	const dataUri = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString('base64')}`;
	const targetFolder =
		input.assetFolder ??
		`${sanitizePublicIdSegment(input.eventType)}/${sanitizePublicIdSegment(input.slug)}/assets`;

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

export async function uploadOrReconcileCloudinaryAsset(
	input: CloudinaryAssetUploadInput,
): Promise<CloudinaryAssetResult> {
	const config = resolveCloudinaryConfigFromEnv();
	initCloudinary(config);

	const publicId = buildCloudinaryPublicId(input);
	const canonicalSecureUrl = buildCloudinaryDeliveryUrl(config.cloudName, publicId);
	const canQueryCloudinary =
		isUsableCredential(config.cloudName) &&
		isUsableCredential(config.apiKey) &&
		isUsableCredential(config.apiSecret);

	const existingResult = canQueryCloudinary
		? await findExistingAsset(publicId, input, canonicalSecureUrl)
		: null;
	if (existingResult) return existingResult;

	if (input.dryRun) {
		return buildPredictedAssetResult(publicId, input, canonicalSecureUrl);
	}

	assertCloudinaryCredentials(config);
	return uploadCloudinaryAsset(publicId, input, canonicalSecureUrl);
}
