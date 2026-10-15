export const prerender = false;

import type { APIRoute } from 'astro';
import { parsePreviewMediaAsset } from '@/lib/invitation/preview/preview-media-token';
import { renderPreviewMedia } from '@/lib/invitation/preview/preview-media-renderer';
import { resolvePreviewMediaSource } from '@/lib/invitation/preview/preview-media-source';
import {
	findInvitationAccessRecord,
	isPublishedInvitationExpired,
} from '@/lib/invitation/access/invitation-access.repository';
import { resolvePublicSiteOrigin } from '@/lib/invitation/social-metadata';
import { fetchOwnStaticAsset } from '@/lib/server/static-assets-provider';

/**
 * Watermarked bytes of an unpaid invitation's photo. The sealed token is the only
 * input; each URL is content-addressed, so a shared cache may keep it (30 days at the
 * CDN, one day in browsers). Paid, disabled or expired invitations get nothing here: their pages
 * reference the original photos or no photos at all.
 */
const SHARED_CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000';
const PRIVATE_CACHE_CONTROL = 'no-store, private';
const ROBOTS = 'noindex, noimageindex, nofollow';
const SOURCE_TIMEOUT_MS = 10_000;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function emptyResponse(status: number): Response {
	return new Response(null, {
		status,
		headers: { 'Cache-Control': PRIVATE_CACHE_CONTROL, 'X-Robots-Tag': ROBOTS },
	});
}

export const GET: APIRoute = async ({ params, url }) => {
	// Generated URLs never carry a query: refuse variants that would only bust the cache.
	if (url.search) return emptyResponse(400);

	const reference = parsePreviewMediaAsset(params.asset);
	if (!reference) return emptyResponse(404);
	const source = resolvePreviewMediaSource(reference.source, url.origin);
	if (!source) return emptyResponse(404);

	const access = await findInvitationAccessRecord(reference.invitationId);
	if (!access || access.paymentStatus !== 'unpaid' || access.publicAccess !== 'enabled') {
		return emptyResponse(404);
	}
	if (await isPublishedInvitationExpired(reference.invitationId)) return emptyResponse(404);

	let bytes: Uint8Array;
	try {
		const init = { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) };
		// Same-origin originals (bundled `/_astro/*` files) never leave the host: a Worker
		// cannot fetch its own origin.
		const upstream =
			source.origin === url.origin
				? await fetchOwnStaticAsset(source, init)
				: await fetch(source, init);
		const declaredLength = Number(upstream.headers.get('content-length') ?? '0');
		if (!upstream.ok || declaredLength > MAX_SOURCE_BYTES) return emptyResponse(502);
		bytes = new Uint8Array(await upstream.arrayBuffer());
		if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES)
			return emptyResponse(502);
	} catch (error) {
		console.error('[preview-media] Source unavailable', {
			host: source.host,
			reason: error instanceof Error ? `${error.name}: ${error.message}` : 'unknown',
		});
		return emptyResponse(502);
	}

	try {
		const rendered = await renderPreviewMedia({
			bytes,
			variant: reference.variant,
			invitationId: reference.invitationId,
			termsUrl: new URL('/terminos', resolvePublicSiteOrigin()).href,
		});
		return new Response(new Uint8Array(rendered.bytes), {
			status: 200,
			headers: {
				'Content-Type': rendered.contentType,
				'Cache-Control': SHARED_CACHE_CONTROL,
				'X-Robots-Tag': ROBOTS,
				'Content-Disposition': `inline; filename="vista-previa-celebra-me.${reference.variant === 'og' ? 'jpg' : 'webp'}"`,
			},
		});
	} catch (error) {
		console.error('[preview-media] Render failed', {
			reason: error instanceof Error ? error.message : 'unknown',
		});
		return emptyResponse(502);
	}
};
