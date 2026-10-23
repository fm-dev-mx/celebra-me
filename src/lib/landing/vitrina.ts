/** Pure helpers for the landing showroom script (vitrina-client.ts). */

/** Event slug from a location hash (`#boda` → `boda`) when the showroom has that event. */
export function eventFromHash(hash: string, eventSlugs: readonly string[]): string | undefined {
	const slug = decodeURIComponent(hash.replace(/^#/, ''));
	return eventSlugs.includes(slug) ? slug : undefined;
}

/** Whole days from `now` to a `YYYY-MM-DD` local date; never negative. */
export function daysUntil(isoDate: string, now: Date): number {
	const [year, month, day] = isoDate.split('-').map(Number);
	const target = new Date(year, month - 1, day);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
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
