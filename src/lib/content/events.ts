import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type EventContentEntry =
	| CollectionEntry<'events'>
	| CollectionEntry<'event-demos'>
	| CollectionEntry<'event-templates'>;

export type RoutableEventEntry = CollectionEntry<'events'> | CollectionEntry<'event-demos'>;

export function getContentEntrySlug(id: string): string {
	const segments = id.split('/');
	return segments[segments.length - 1] || id;
}

export async function getRoutableEventEntry(
	slug: string,
	expectedEventType?: string,
): Promise<RoutableEventEntry | null> {
	const liveEntry = await getEntry('events', slug);
	if (liveEntry && (!expectedEventType || liveEntry.data.eventType === expectedEventType)) {
		return liveEntry;
	}

	const demoEntries = (await getCollection('event-demos')) ?? [];
	return (
		demoEntries.find((entry: CollectionEntry<'event-demos'>) => {
			return (
				getContentEntrySlug(entry.id) === slug &&
				(!expectedEventType || entry.data.eventType === expectedEventType)
			);
		}) ?? null
	);
}

export async function getEventTemplateEntry(
	slug: string,
	expectedEventType?: string,
): Promise<CollectionEntry<'event-templates'> | null> {
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
