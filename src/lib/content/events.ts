import { getCollection, type CollectionEntry } from 'astro:content';

export type EventContentEntry =
	| CollectionEntry<'event-demos'>
	| CollectionEntry<'event-templates'>;

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
	const demoEntry = demoEntries.find((entry: CollectionEntry<'event-demos'>) => {
		return (
			getContentEntrySlug(entry.id) === slug &&
			(!expectedEventType || entry.data.eventType === expectedEventType)
		);
	});

	if (demoEntry) return demoEntry;

	const templateEntries = (await getCollection('event-templates')) ?? [];
	return (
		templateEntries.find((entry: CollectionEntry<'event-templates'>) => {
			return (
				getContentEntrySlug(entry.id) === slug &&
				(!expectedEventType || entry.data.eventType === expectedEventType)
			);
		}) ?? null
	);
}


