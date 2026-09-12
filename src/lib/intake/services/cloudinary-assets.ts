import { imageExtension } from './asset-policy';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

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

export type CloudinaryTargetEnvironment = 'preview' | 'production';

export interface CloudinaryAssetUploadInput {
	targetEnvironment: CloudinaryTargetEnvironment;
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

export interface CloudinaryAssetVerificationInput {
	publicId: string;
	sha256: string;
	mimeType: string;
	width?: number;
	height?: number;
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
	const signature = `${config.cloudName}:${config.apiKey}:${config.apiSecret}`;
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
	targetEnvironment?: CloudinaryTargetEnvironment;
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
	const prefix = input.targetEnvironment ? `${input.targetEnvironment}/` : '';
	return `${prefix}${eventType}/${slug}/assets/${sanitizedKey}-${shaPrefix}`;
}

export function classifyCloudinaryPublicIdEnvironment(
	publicId: string,
): CloudinaryTargetEnvironment | 'legacy' | 'invalid' {
	const normalized = publicId.replace(/^\/+|\/+$/g, '');
	if (/^preview\/[^/]+\/[^/]+\/assets\/[^/]+$/u.test(normalized)) return 'preview';
	if (/^production\/[^/]+\/[^/]+\/assets\/[^/]+$/u.test(normalized)) return 'production';
	if (/^[^/]+\/[^/]+\/assets\/[^/]+$/u.test(normalized)) return 'legacy';
	return 'invalid';
}

export function assertCloudinaryPublicIdEnvironment(
	publicId: string,
	targetEnvironment: CloudinaryTargetEnvironment,
	options: { allowLegacyRead?: boolean } = {},
): void {
	const observed = classifyCloudinaryPublicIdEnvironment(publicId);
	if (observed === targetEnvironment) return;
	if (observed === 'legacy' && options.allowLegacyRead) return;
	throw new Error(
		`Cloudinary asset namespace mismatch: expected ${targetEnvironment}, observed ${observed}.`,
	);
}

export function assertCloudinaryMutationTarget(
	publicId: string,
	target: { environment: CloudinaryTargetEnvironment; eventType: string; slug: string },
): void {
	assertCloudinaryPublicIdEnvironment(publicId, target.environment);
	const prefix =
		target.environment + '/' +
		sanitizePublicIdSegment(target.eventType) + '/' +
		sanitizePublicIdSegment(target.slug) + '/assets/';
	if (!publicId.startsWith(prefix) || publicId.length <= prefix.length) {
		throw new Error('Cloudinary asset does not belong to the target invitation namespace.');
	}
}
export function buildCloudinaryDeliveryUrl(
	cloudName: string,
	publicId: string,
	mimeType = 'image/webp',
): string {
	const name = cloudName.trim() || 'unconfigured';
	return `https://res.cloudinary.com/${name}/image/upload/v1/${publicId}.${imageExtension(mimeType)}`;
}

function normalizeCloudinaryDeliveryUrl(value: string): string {
	const url = new URL(value);
	url.search = '';
	url.hash = '';
	return url.toString().replace(/\/v\d+\//, '/v1/');
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

function assertCloudinaryResourceMatches(
	resource: CloudinaryResourceData,
	input: CloudinaryAssetVerificationInput,
): void {
	if (resource.public_id !== input.publicId) {
		throw new Error('Cloudinary resource public ID does not match the requested asset.');
	}
	const observedHash = resource.context?.custom?.sha256 ?? resource.context?.sha256;
	if (observedHash !== input.sha256) {
		throw new Error(
			`Cloudinary asset "${input.publicId}" SHA-256 context does not match the canonical asset.`,
		);
	}
	if (!Number.isFinite(resource.width) || resource.width <= 0 ||
		!Number.isFinite(resource.height) || resource.height <= 0) {
		throw new Error('Cloudinary asset has invalid dimensions.');
	}	if (resource.resource_type !== 'image') {
		throw new Error(`Cloudinary asset "${input.publicId}" is not an image resource.`);
	}
	if (resource.format !== imageExtension(input.mimeType)) {
		throw new Error(
			`Cloudinary asset "${input.publicId}" format "${resource.format}" does not match "${input.mimeType}".`,
		);
	}
	if (input.width !== undefined && resource.width !== input.width) {
		throw new Error(
			`Cloudinary asset "${input.publicId}" width does not match the canonical asset.`,
		);
	}
	if (input.height !== undefined && resource.height !== input.height) {
		throw new Error(
			`Cloudinary asset "${input.publicId}" height does not match the canonical asset.`,
		);
	}
}

/**
 * Read-only provider verification for a previously hosted managed asset.
 * Content-only releases call this before preserving the reference.
 */
export async function verifyCloudinaryAsset(
	input: CloudinaryAssetVerificationInput,
): Promise<CloudinaryAssetResult> {
	const config = resolveCloudinaryConfigFromEnv();
	assertCloudinaryCredentials(config);
	initCloudinary(config);
	try {
		const resource = (await cloudinary.api.resource(input.publicId, {
			context: true,
		})) as CloudinaryResourceData;
		assertCloudinaryResourceMatches(resource, input);
		const secureUrl =
			resource.secure_url ??
			buildCloudinaryDeliveryUrl(config.cloudName, input.publicId, input.mimeType);
		const canonicalSecureUrl = buildCloudinaryDeliveryUrl(
			config.cloudName,
			input.publicId,
			input.mimeType,
		);
		if (normalizeCloudinaryDeliveryUrl(secureUrl) !== canonicalSecureUrl) {
			throw new Error(
				`Cloudinary asset "${input.publicId}" does not expose the canonical delivery URL.`,
			);
		}
		const response = await fetch(canonicalSecureUrl, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) {
			throw new Error(
				`Cloudinary asset "${input.publicId}" delivery failed (HTTP ${response.status}).`,
			);
		}
		const deliveryMime = response.headers.get('content-type')?.split(';')[0]?.trim();
		if (deliveryMime !== input.mimeType) {
			throw new Error('Cloudinary delivery MIME does not match the canonical asset.');
		}
		const deliveredBytes = Buffer.from(await response.arrayBuffer());
		if (createHash('sha256').update(deliveredBytes).digest('hex') !== input.sha256) {
			throw new Error('Cloudinary delivered binary SHA-256 does not match the canonical asset.');
		}
		const deliveredMetadata = await sharp(deliveredBytes).metadata();
		if (deliveredMetadata.width !== resource.width || deliveredMetadata.height !== resource.height) {
			throw new Error('Cloudinary delivered dimensions do not match the resource metadata.');
		}
		return buildAssetResult(
			resource,
			{
				targetEnvironment: 'preview',
				eventType: '',
				slug: '',
				key: input.publicId,
				displayName: input.publicId,
				alt: '',
				bytes: new Uint8Array(),
				sha256: input.sha256,
				mimeType: input.mimeType,
				width: input.width,
				height: input.height,
			},
			secureUrl,
			'REUSE',
		);
	} catch (error: unknown) {
		const status = getCloudinaryErrorStatus(error);
		if (status === 404) {
			throw new Error(`Cloudinary asset "${input.publicId}" does not exist.`, {
				cause: error,
			});
		}
		throw error;
	}
}

/** Cloudinary Node SDK may put http_code on the root or on a nested `error` object. */
export function getCloudinaryErrorStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	if ('http_code' in error && typeof error.http_code === 'number') {
		return error.http_code;
	}
	if ('error' in error) {
		const nested = error.error;
		if (
			typeof nested === 'object' &&
			nested !== null &&
			'http_code' in nested &&
			typeof nested.http_code === 'number'
		) {
			return nested.http_code;
		}
	}
	return undefined;
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

		try {
			assertCloudinaryResourceMatches(resource, {
				publicId,
				sha256: input.sha256,
				mimeType: input.mimeType,
				width: input.width,
				height: input.height,
			});
		} catch (error: unknown) {
			const observedHash = resource.context?.custom?.sha256 ?? resource.context?.sha256;
			if (observedHash !== input.sha256) {
				throw new Error(
					`Cloudinary public ID collision detected for "${publicId}": existing sha256 (${observedHash?.slice(0, 12) ?? 'missing'}…) does not match input sha256 (${input.sha256.slice(0, 12)}…).`,
					{ cause: error },
				);
			}
			throw error;
		}

		if (
			resource.secure_url &&
			normalizeCloudinaryDeliveryUrl(resource.secure_url) !== canonicalSecureUrl
		) {
			throw new Error('Cloudinary resource delivery URL does not match its canonical URL.');
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
		format: imageExtension(input.mimeType),
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
		`${input.targetEnvironment}/${sanitizePublicIdSegment(input.eventType)}/${sanitizePublicIdSegment(input.slug)}/assets`;

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
	assertCloudinaryPublicIdEnvironment(publicId, input.targetEnvironment);
	const canonicalSecureUrl = buildCloudinaryDeliveryUrl(
		config.cloudName,
		publicId,
		input.mimeType,
	);
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
