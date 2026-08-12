import type { CollectionEntry } from 'astro:content';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

/** Compatibility fixtures intentionally exercise the schema input normalizer. */
export type EventContentFixtureInput = {
	eventType: string;
	title: string;
	theme: Record<string, unknown>;
	hero: Record<string, unknown>;
	[key: string]: unknown;
};

export function parseEventContentData(input: unknown): CollectionEntry<'event-demos'>['data'] {
	return eventContentSchema.parse(input);
}

export function buildEventContentData(
	input: EventContentFixtureInput,
): CollectionEntry<'event-demos'>['data'] {
	return parseEventContentData({
		quote: { text: 'Test fixture quote' },
		...input,
	});
}

export function buildEventDemoEntry(
	input: EventContentFixtureInput,
	id = 'test/test-event.json',
): CollectionEntry<'event-demos'> {
	return {
		id,
		collection: 'event-demos',
		data: buildEventContentData(input),
	};
}
