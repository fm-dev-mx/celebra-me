import type { CollectionEntry } from 'astro:content';
import type { z } from 'zod';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

type EventContentSchemaInput = z.input<typeof eventContentSchema>;
type RequiredEventContentFixtureFields = 'eventType' | 'title' | 'theme' | 'hero';

export type EventContentFixtureInput = Pick<
	EventContentSchemaInput,
	RequiredEventContentFixtureFields
> &
	Partial<Omit<EventContentSchemaInput, RequiredEventContentFixtureFields>>;

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
