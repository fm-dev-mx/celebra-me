import type { APIRoute } from 'astro';
import { badRequest, jsonResponse } from '@/lib/rsvp-v2/http';
import { resolveLegacyTokenToCanonicalUrl } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 400): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const eventSlug = sanitize(url.searchParams.get('eventSlug'), 120);
		const token = sanitize(url.searchParams.get('token'), 2048);
		if (!eventSlug || !token) return badRequest('eventSlug y token son obligatorios.');

		const canonicalUrl = await resolveLegacyTokenToCanonicalUrl({
			eventSlug,
			token,
			origin: url.origin,
		});
		if (!canonicalUrl) {
			return jsonResponse({ canonicalUrl: null }, 404);
		}
		return jsonResponse({ canonicalUrl });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		return jsonResponse({ message }, 500);
	}
};
