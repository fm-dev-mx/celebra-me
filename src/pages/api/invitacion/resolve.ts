import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { resolveLegacyTokenToCanonicalUrl } from '@/lib/rsvp/services/invitation-context.service';

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
		return errorResponse(error);
	}
};
