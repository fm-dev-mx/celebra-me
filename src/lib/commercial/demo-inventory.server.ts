import { getCollection } from 'astro:content';
import { getContentEntrySlug } from '@/lib/content/events';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import type { DemoLinkItem } from '@/lib/tracking/demo-conversion-report';
import { getDemoRouteSlug } from '@/lib/invitation/demo-routes';

export async function loadDemoInventory() {
	return (await getCollection('event-demos'))
		.map((entry) => {
			const slug = getContentEntrySlug(entry.id);
			const card = DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug);
			return { slug, title: card?.title ?? slug, eventType: entry.data.eventType };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Short alias (`/brisa`) when the demo has one; the long route only as a fallback. */
export function buildDemoHref(eventType: string, slug: string): string {
	const routeSlug = getDemoRouteSlug(slug);
	return routeSlug
		? `/${encodeURIComponent(routeSlug)}`
		: `/${encodeURIComponent(eventType)}/${encodeURIComponent(slug)}`;
}

/** Every repository demo with its public route, including demos hidden from the showroom. */
export async function loadDemoLinks(): Promise<DemoLinkItem[]> {
	return (await getCollection('event-demos'))
		.map((entry) => {
			const slug = getContentEntrySlug(entry.id);
			const card = DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug);
			return {
				slug,
				title: card?.title ?? slug,
				invitationTitle: entry.data.title,
				eventType: entry.data.eventType,
				href: buildDemoHref(entry.data.eventType, slug),
				inShowroom: card?.visibility === 'featured' && card.reviewStatus === 'approved',
			};
		})
		.sort((a, b) => a.eventType.localeCompare(b.eventType) || a.slug.localeCompare(b.slug));
}
