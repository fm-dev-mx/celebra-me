import { getCollection } from 'astro:content';
import { getContentEntrySlug } from '@/lib/content/events';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';

export async function loadDemoInventory() {
	return (await getCollection('event-demos'))
		.map((entry) => {
			const slug = getContentEntrySlug(entry.id);
			const card = DEMO_SHOWROOM_ITEMS.find((item) => item.slug === slug);
			return { slug, title: card?.title ?? slug, eventType: entry.data.eventType };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}
