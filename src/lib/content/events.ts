import { getCollection, type CollectionEntry } from 'astro:content';

export type EventContentEntry = CollectionEntry<'event-demos'>;

/**
 * Invitation content as the adapter reads it: a published database row or a bundled demo.
 * `assetSlug` overrides where images are looked up (draft previews of a renamed invitation).
 */
export interface InvitationContentDocument {
	slug: string;
	content: Record<string, unknown>;
	assetSlug?: string;
}

export function getContentEntrySlug(id: string): string {
	const segments = id.split('/');
	const lastSegment = segments[segments.length - 1] || id;
	return lastSegment.replace(/\.(json|md|mdx)$/, '');
}

export function contentDocumentFromEntry(entry: EventContentEntry): InvitationContentDocument {
	return { slug: getContentEntrySlug(entry.id), content: entry.data };
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
