import { getCollection, type CollectionEntry } from 'astro:content';

export type EventContentEntry = CollectionEntry<'event-demos'>;

export function getContentEntrySlug(id: string): string {
	const segments = id.split('/');
	const lastSegment = segments[segments.length - 1] || id;
	return lastSegment.replace(/\.(json|md|mdx)$/, '');
}

export async function getRoutableEventEntry(
	slug: string,
	expectedEventType?: string,
): Promise<EventContentEntry | null> {
	const demoEntries = (await getCollection('event-demos')) ?? [];
	return (
		demoEntries.find((entry: EventContentEntry) => {
			return (
				getContentEntrySlug(entry.id) === slug &&
				(!expectedEventType || entry.data.eventType === expectedEventType)
			);
		}) ?? null
	);
}
