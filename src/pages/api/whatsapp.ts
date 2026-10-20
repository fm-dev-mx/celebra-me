import type { APIRoute } from 'astro';
import { getEnv } from '@/lib/server/env';
import { buildWaMeUrl, resolveContactPhone } from '@/utils/whatsapp';

export const prerender = false;

/** wa.me accepts long prefilled messages; anything beyond this is not a CTA message. */
const MAX_MESSAGE_LENGTH = 2_000;

/**
 * Prerendered pages cannot know the CONTACT_WHATSAPP Worker secret, so their WhatsApp CTAs
 * point here. Only the `text` query travels; the destination host is always wa.me.
 */
export const GET: APIRoute = ({ url }) => {
	const phone = resolveContactPhone(getEnv('CONTACT_WHATSAPP'));
	if (!phone) {
		console.error('[whatsapp] CONTACT_WHATSAPP is missing or is the placeholder number.');
		return new Response('El contacto por WhatsApp no está disponible por ahora.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
		});
	}
	const message = url.searchParams.get('text')?.slice(0, MAX_MESSAGE_LENGTH) ?? null;
	return new Response(null, {
		status: 302,
		headers: { Location: buildWaMeUrl(phone, message), 'Cache-Control': 'no-store' },
	});
};
