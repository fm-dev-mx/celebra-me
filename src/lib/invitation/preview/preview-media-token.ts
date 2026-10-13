/**
 * Sealed references for watermarked preview media (server-only).
 *
 * An unpaid invitation's HTML never carries the original photo URL: each photo points
 * at `/vista-previa/<token>.<ext>`, where the token is the AES-256-GCM encryption of
 * the invitation id, the source URL and the variant. The nonce is derived from the
 * plaintext (HMAC), so the same photo always yields the same URL and the CDN can cache
 * it, while different photos never share a nonce.
 *
 * Keys are derived (HKDF) from PREVIEW_MEDIA_SECRET, or from the service-role key when
 * that is not configured, so no deployment needs a new secret. Rotating either changes
 * every preview URL, which is harmless.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync } from 'node:crypto';
import { getSupabaseServiceRoleKey } from '@/lib/server/supabase-credentials';

export type PreviewMediaVariant = 'photo' | 'og';

export interface PreviewMediaReference {
	invitationId: string;
	/** Absolute URL or same-origin path of the original image. */
	source: string;
	variant: PreviewMediaVariant;
}

const TOKEN_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const VARIANT_EXTENSIONS: Record<PreviewMediaVariant, 'webp' | 'jpg'> = {
	photo: 'webp',
	og: 'jpg',
};

const PREVIEW_MEDIA_PATH_PREFIX = '/vista-previa/';

interface PreviewMediaKeys {
	encryption: Buffer;
	nonce: Buffer;
}

let cachedKeys: { material: string; keys: PreviewMediaKeys } | null = null;

function resolveKeys(): PreviewMediaKeys {
	const material = process.env.PREVIEW_MEDIA_SECRET?.trim() || getSupabaseServiceRoleKey();
	if (cachedKeys?.material === material) return cachedKeys.keys;
	const derive = (info: string) =>
		Buffer.from(
			hkdfSync(
				'sha256',
				material,
				'celebra-me',
				`preview-media/v${TOKEN_VERSION}/${info}`,
				32,
			),
		);
	const keys = { encryption: derive('encryption'), nonce: derive('nonce') };
	cachedKeys = { material, keys };
	return keys;
}

export function sealPreviewMediaReference(reference: PreviewMediaReference): string {
	const keys = resolveKeys();
	const plaintext = Buffer.from(
		JSON.stringify({
			v: TOKEN_VERSION,
			i: reference.invitationId,
			u: reference.source,
			k: reference.variant,
		}),
	);
	const nonce = createHmac('sha256', keys.nonce)
		.update(plaintext)
		.digest()
		.subarray(0, NONCE_BYTES);
	const cipher = createCipheriv('aes-256-gcm', keys.encryption, nonce);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]).toString('base64url');
}

/** Null for anything not sealed by this server (tampered, truncated, other keys). */
export function openPreviewMediaReference(token: string): PreviewMediaReference | null {
	if (!/^[A-Za-z0-9_-]{40,4096}$/.test(token)) return null;
	try {
		const keys = resolveKeys();
		const sealed = Buffer.from(token, 'base64url');
		if (sealed.length <= NONCE_BYTES + TAG_BYTES) return null;
		const nonce = sealed.subarray(0, NONCE_BYTES);
		const tag = sealed.subarray(sealed.length - TAG_BYTES);
		const decipher = createDecipheriv('aes-256-gcm', keys.encryption, nonce);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([
			decipher.update(sealed.subarray(NONCE_BYTES, sealed.length - TAG_BYTES)),
			decipher.final(),
		]);
		const payload = JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>;
		if (
			payload.v !== TOKEN_VERSION ||
			typeof payload.i !== 'string' ||
			typeof payload.u !== 'string' ||
			(payload.k !== 'photo' && payload.k !== 'og')
		) {
			return null;
		}
		return { invitationId: payload.i, source: payload.u, variant: payload.k };
	} catch {
		return null;
	}
}

export function buildPreviewMediaPath(reference: PreviewMediaReference): string {
	return `${PREVIEW_MEDIA_PATH_PREFIX}${sealPreviewMediaReference(reference)}.${VARIANT_EXTENSIONS[reference.variant]}`;
}

/** Splits `<token>.<ext>` and checks the extension matches the sealed variant. */
export function parsePreviewMediaAsset(asset: string | undefined): PreviewMediaReference | null {
	const match = asset?.match(/^([A-Za-z0-9_-]+)\.(webp|jpg)$/);
	if (!match) return null;
	const reference = openPreviewMediaReference(match[1]);
	if (!reference || VARIANT_EXTENSIONS[reference.variant] !== match[2]) return null;
	return reference;
}
