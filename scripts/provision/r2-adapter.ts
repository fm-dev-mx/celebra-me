/**
 * Cloudflare R2 hosting for managed invitation images (Preview and Production provisioning).
 *
 * Objects are content-addressed (`invitations/<eventType>/<slug>/<key>-<sha256>.<ext>`), so an
 * existing object is reused only when its delivered bytes match, and is never overwritten.
 * Every image gets a 1200x630 JPEG social card beside it (`<...>-<sha256>.og.jpg`) and WebP width
 * variants (`<...>-<sha256>.w<width>.webp`), because the media domain serves bytes as stored and
 * has no transformation URLs.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';
import {
	R2_IMMUTABLE_CACHE_CONTROL,
	R2_INVITATION_MEDIA,
	buildR2ObjectKey,
	buildR2PublicUrl,
	buildR2SocialObjectKey,
	buildR2VariantObjectKey,
	type R2MediaTargetEnvironment,
} from '../../src/lib/intake/services/r2-invitation-media.ts';
import {
	RESPONSIVE_IMAGE_WIDTHS,
	encodeResponsiveVariants,
} from '../../src/lib/images/responsive-variants.ts';
import { sharpImageTransformer } from '../../src/lib/images/sharp-image-transformer.ts';

export { buildR2SocialImageUrl } from '../../src/lib/intake/services/r2-invitation-media.ts';

const SOCIAL_CARD = { width: 1200, height: 630, quality: 82 } as const;

// Provisioning CLIs run from the repository root (pnpm scripts).
const REPO_ROOT = process.cwd();

export interface R2AssetIdentity {
	eventType: string;
	slug: string;
	key: string;
	sha256: string;
	mimeType: string;
}

export interface R2AssetUploadInput extends R2AssetIdentity {
	targetEnvironment: R2MediaTargetEnvironment;
	bytes: Uint8Array;
}

export interface R2AssetUploadResult {
	objectKey: string;
	secureUrl: string;
	action: 'UPLOAD' | 'REUSE';
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function buildR2AssetObjectKey(identity: R2AssetIdentity): string {
	return buildR2ObjectKey(identity);
}

/** A managed object must live under its own invitation's prefix. */
export function assertR2MutationTarget(
	objectKey: string,
	target: { eventType: string; slug: string },
): void {
	if (!objectKey.startsWith(`invitations/${target.eventType}/${target.slug}/`))
		throw new Error(
			`R2 object ${objectKey} belongs to another invitation than ${target.eventType}/${target.slug}.`,
		);
}

/** The Windows shell joins arguments, so values with spaces need their own quotes there. */
function shellArg(value: string): string {
	return process.platform === 'win32' ? `"${value}"` : value;
}

function wranglerBinary(): string {
	const name = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
	return shellArg(resolve(REPO_ROOT, 'node_modules', '.bin', name));
}

/** Uncached read of the public object; the query keeps CDN entries out of verification. */
async function readPublished(
	target: R2MediaTargetEnvironment,
	objectKey: string,
): Promise<{ bytes: Uint8Array; status: number; contentType: string | null }> {
	const response = await fetch(`${buildR2PublicUrl(target, objectKey)}?verify=${randomUUID()}`, {
		redirect: 'error',
	});
	const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
	return {
		bytes,
		status: response.status,
		contentType: response.headers.get('content-type')?.split(';')[0]?.trim() ?? null,
	};
}

function putObject(
	target: R2MediaTargetEnvironment,
	objectKey: string,
	bytes: Uint8Array,
	mimeType: string,
): void {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-r2-'));
	try {
		// Wrangler runs inside `dir`, so the file goes by its key-derived name and needs no quoting.
		const file = basename(objectKey);
		writeFileSync(join(dir, file), bytes);
		execFileSync(
			wranglerBinary(),
			[
				'r2',
				'object',
				'put',
				`${R2_INVITATION_MEDIA[target].bucket}/${objectKey}`,
				'--file',
				file,
				'--content-type',
				mimeType,
				'--cache-control',
				shellArg(R2_IMMUTABLE_CACHE_CONTROL),
				'--remote',
			],
			{ cwd: dir, stdio: 'pipe', shell: process.platform === 'win32' },
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function buildSocialCard(original: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(
		await sharp(original)
			.rotate()
			.resize(SOCIAL_CARD.width, SOCIAL_CARD.height, { fit: 'cover', position: 'attention' })
			.jpeg({ quality: SOCIAL_CARD.quality, mozjpeg: true })
			.toBuffer(),
	);
}

async function isSocialCard(bytes: Uint8Array): Promise<boolean> {
	const meta = await sharp(bytes).metadata();
	return (
		meta.format === 'jpeg' &&
		meta.width === SOCIAL_CARD.width &&
		meta.height === SOCIAL_CARD.height
	);
}

/** Reads the delivered object and checks it holds exactly the canonical bytes. */
export async function verifyR2Asset(input: {
	targetEnvironment: R2MediaTargetEnvironment;
	objectKey: string;
	sha256: string;
	mimeType: string;
}): Promise<void> {
	const published = await readPublished(input.targetEnvironment, input.objectKey);
	if (published.status !== 200)
		throw new Error(`R2 object ${input.objectKey} delivery failed (HTTP ${published.status}).`);
	if (published.contentType !== input.mimeType)
		throw new Error(
			`R2 object MIME "${published.contentType ?? 'missing'}" does not match "${input.mimeType}".`,
		);
	if (sha256(published.bytes) !== input.sha256)
		throw new Error(`R2 object ${input.objectKey} does not hold the canonical bytes.`);
}

async function ensureSocialCard(
	target: R2MediaTargetEnvironment,
	objectKey: string,
	original: Uint8Array,
): Promise<void> {
	const socialKey = buildR2SocialObjectKey(objectKey);
	const existing = await readPublished(target, socialKey);
	if (existing.status === 200 && (await isSocialCard(existing.bytes))) return;
	if (existing.status !== 200 && existing.status !== 404)
		throw new Error(`R2 social card ${socialKey} read failed (HTTP ${existing.status}).`);
	putObject(target, socialKey, await buildSocialCard(original), 'image/jpeg');
	const delivered = await readPublished(target, socialKey);
	if (delivered.status !== 200 || !(await isSocialCard(delivered.bytes)))
		throw new Error(`R2 social card ${socialKey} read-back verification failed.`);
}

interface R2VariantReport {
	written: string[];
	present: string[];
}

/**
 * Writes the WebP width variants of a hosted image that the bucket does not serve yet, and reads
 * each written one back. Existing variants are kept: they are derived bytes, not canonical ones.
 * `dryRun` only reports the missing keys.
 */
async function ensureResponsiveVariants(
	target: R2MediaTargetEnvironment,
	objectKey: string,
	original: Uint8Array,
	options: { dryRun?: boolean } = {},
): Promise<R2VariantReport> {
	const report: R2VariantReport = { written: [], present: [] };
	const missing: string[] = [];
	for (const width of RESPONSIVE_IMAGE_WIDTHS) {
		const variantKey = buildR2VariantObjectKey(objectKey, width);
		const existing = await readPublished(target, variantKey);
		if (existing.status === 200 && existing.contentType === 'image/webp') {
			report.present.push(variantKey);
			continue;
		}
		if (existing.status !== 404)
			throw new Error(`R2 variant ${variantKey} read failed (HTTP ${existing.status}).`);
		missing.push(variantKey);
	}
	if (missing.length === 0 || options.dryRun) {
		report.written = options.dryRun ? missing : [];
		return report;
	}
	for (const variant of await encodeResponsiveVariants(sharpImageTransformer, original)) {
		const variantKey = buildR2VariantObjectKey(objectKey, variant.width);
		if (!missing.includes(variantKey)) continue;
		putObject(target, variantKey, variant.data, 'image/webp');
		const delivered = await readPublished(target, variantKey);
		if (delivered.status !== 200 || delivered.contentType !== 'image/webp')
			throw new Error(`R2 variant ${variantKey} read-back verification failed.`);
		report.written.push(variantKey);
	}
	return report;
}

/**
 * Uploads one canonical image unless the bucket already serves the same bytes, then verifies
 * the delivered object, its social card and its width variants.
 */
export async function uploadOrReconcileR2Asset(
	input: R2AssetUploadInput,
): Promise<R2AssetUploadResult> {
	if (sha256(input.bytes) !== input.sha256)
		throw new Error(`Canonical bytes for "${input.key}" do not match their sha256.`);
	const objectKey = buildR2AssetObjectKey(input);
	const target = input.targetEnvironment;
	const existing = await readPublished(target, objectKey);
	let action: R2AssetUploadResult['action'] = 'REUSE';
	if (existing.status === 404) {
		putObject(target, objectKey, input.bytes, input.mimeType);
		action = 'UPLOAD';
	} else if (existing.status !== 200) {
		throw new Error(`R2 object ${objectKey} read failed (HTTP ${existing.status}).`);
	} else if (sha256(existing.bytes) !== input.sha256) {
		throw new Error(`R2 object ${objectKey} already holds different bytes.`);
	}
	await verifyR2Asset({ ...input, objectKey });
	if (input.mimeType.startsWith('image/')) {
		await ensureSocialCard(target, objectKey, input.bytes);
		await ensureResponsiveVariants(target, objectKey, input.bytes);
	}
	return { objectKey, secureUrl: buildR2PublicUrl(target, objectKey), action };
}
