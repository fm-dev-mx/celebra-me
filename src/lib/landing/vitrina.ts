/** Pure helpers for the landing showroom script (vitrina-client.ts). */

/** Event slug from a location hash (`#boda` → `boda`) when the showroom has that event. */
export function eventFromHash(hash: string, eventSlugs: readonly string[]): string | undefined {
	const slug = decodeURIComponent(hash.replace(/^#/, ''));
	return eventSlugs.includes(slug) ? slug : undefined;
}

/**
 * Replaces the `text` parameter of a WhatsApp link, keeping its host: wa.me on server-rendered
 * pages, the `/api/whatsapp` redirect on prerendered ones.
 */
export function withWhatsAppText(href: string, text: string, base: string): string {
	const url = new URL(href, base);
	url.searchParams.set('text', text);
	return url.origin === new URL(base).origin ? `${url.pathname}${url.search}` : url.toString();
}
