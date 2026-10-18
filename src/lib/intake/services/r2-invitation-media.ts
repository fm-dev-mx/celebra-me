/**
 * Cloudflare R2 hosting for invitation images.
 *
 * Each hosted environment owns one bucket behind its own custom domain. Object keys are
 * content-addressed (`<key>-<sha256>.<ext>`), so a published URL never changes bytes and can be
 * cached as immutable. The Worker entry installs the `INVITATION_MEDIA` binding before the first
 * request (`src/worker.ts`); hosts without it keep the previous provider.
 */

export type R2MediaTargetEnvironment = 'preview' | 'production';

export const R2_INVITATION_MEDIA = {
	preview: {
		bucket: 'celebra-me-invitation-media-staging',
		origin: 'https://media-staging.celebra-me.com',
	},
	production: {
		bucket: 'celebra-me-invitation-media',
		origin: 'https://media.celebra-me.com',
	},
} as const satisfies Record<R2MediaTargetEnvironment, { bucket: string; origin: string }>;

export const R2_IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const EXTENSION_BY_MIME: Record<string, string> = {
	'image/webp': 'webp',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a',
};

const SHA256 = /^[a-f0-9]{64}$/u;
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function buildR2ObjectKey(input: {
	eventType: string;
	slug: string;
	key: string;
	sha256: string;
	mimeType: string;
}): string {
	const extension = EXTENSION_BY_MIME[input.mimeType];
	if (!extension) throw new Error(`Unsupported R2 media type "${input.mimeType}".`);
	if (!SHA256.test(input.sha256)) throw new Error('R2 media requires a sha256 digest.');
	if (!SEGMENT.test(input.eventType) || !SEGMENT.test(input.slug))
		throw new Error('R2 media requires a canonical event type and slug.');
	const key = input.key
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (!key) throw new Error('R2 media requires an asset key.');
	return `invitations/${input.eventType}/${input.slug}/${key}-${input.sha256}.${extension}`;
}

/** Social cards need a 1200x630 JPEG; it lives beside the original under the same digest. */
export function buildR2SocialObjectKey(objectKey: string): string {
	const match = objectKey.match(/^(.*-[a-f0-9]{64})\.(?:webp|jpg|png)$/u);
	if (!match) throw new Error('Social image key requires a content-addressed original.');
	return `${match[1]}.og.jpg`;
}

export function buildR2PublicUrl(target: R2MediaTargetEnvironment, objectKey: string): string {
	return `${R2_INVITATION_MEDIA[target].origin}/${objectKey}`;
}

export function isR2InvitationMediaUrl(src: string): boolean {
	try {
		const parsed = new URL(src.trim());
		return (
			parsed.protocol === 'https:' &&
			Object.values(R2_INVITATION_MEDIA).some((entry) => entry.origin === parsed.origin)
		);
	} catch {
		return false;
	}
}

/** Minimal shape of the R2 bucket binding; the repository does not load the workers-types globals. */
export interface InvitationMediaBucket {
	head(key: string): Promise<{ size: number; customMetadata?: Record<string, string> } | null>;
	put(
		key: string,
		value: Uint8Array,
		options: {
			httpMetadata: { contentType: string; cacheControl: string };
			customMetadata: Record<string, string>;
		},
	): Promise<unknown>;
}

let installedBucket: InvitationMediaBucket | undefined;

function isInvitationMediaBucket(value: unknown): value is InvitationMediaBucket {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { head?: unknown }).head === 'function' &&
		typeof (value as { put?: unknown }).put === 'function'
	);
}

/** Adopts `env.INVITATION_MEDIA` from a Worker invocation; a missing binding changes nothing. */
export function installInvitationMediaBinding(env: Record<string, unknown> | undefined): boolean {
	const candidate = env?.INVITATION_MEDIA;
	if (!isInvitationMediaBucket(candidate)) return false;
	installedBucket = candidate;
	return true;
}

export function getInvitationMediaBucket(): InvitationMediaBucket | undefined {
	return installedBucket;
}

/** Forgets the installed binding (tests). */
export function resetInvitationMediaBindingForTests(): void {
	installedBucket = undefined;
}

export interface R2MediaUploadInput {
	target: R2MediaTargetEnvironment;
	objectKey: string;
	bytes: Uint8Array;
	mimeType: string;
	sha256: string;
}

/**
 * Writes one content-addressed object. An existing object with the same digest is reused, and
 * one with another digest under the same key is refused instead of overwritten.
 */
export async function putR2InvitationMedia(
	bucket: InvitationMediaBucket,
	input: R2MediaUploadInput,
): Promise<{ url: string; reused: boolean }> {
	const url = buildR2PublicUrl(input.target, input.objectKey);
	const existing = await bucket.head(input.objectKey);
	if (existing) {
		if (existing.customMetadata?.sha256 !== input.sha256)
			throw new Error(`R2 object ${input.objectKey} already holds different bytes.`);
		return { url, reused: true };
	}
	await bucket.put(input.objectKey, input.bytes, {
		httpMetadata: { contentType: input.mimeType, cacheControl: R2_IMMUTABLE_CACHE_CONTROL },
		customMetadata: { sha256: input.sha256 },
	});
	return { url, reused: false };
}
