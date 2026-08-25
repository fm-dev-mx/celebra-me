import type { CollectionEntry } from 'astro:content';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

/** Test fixtures are assembled as canonical content before schema validation. */
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
	const inputRecord = input as Record<string, unknown>;
	const rsvp = inputRecord.rsvp as Record<string, unknown> | undefined;
	return parseEventContentData({
		quote: { text: 'Test fixture quote' },
		sectionOrder: [
			'quote',
			'countdown',
			'family',
			'location',
			'itinerary',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		],
		composition: { intersections: {} },
		countdown: { variant: 'standard' },
		...input,
		hero: { variant: 'standard', ...input.hero },
		...(inputRecord.family ? { family: { variant: 'standard', ...inputRecord.family } } : {}),
		...(inputRecord.location
			? { location: { variant: 'standard', ...inputRecord.location } }
			: {}),
		...(inputRecord.itinerary
			? { itinerary: { variant: 'standard', ...inputRecord.itinerary } }
			: {}),
		...(inputRecord.gallery ? { gallery: { variant: 'uniform-grid', ...inputRecord.gallery } } : {}),
		...(inputRecord.gifts ? { gifts: { variant: 'standard', ...inputRecord.gifts } } : {}),
		...(inputRecord.countdown
			? { countdown: { variant: 'standard', ...inputRecord.countdown } }
			: {}),
		...(inputRecord.thankYou
			? { thankYou: { variant: 'standard', ...inputRecord.thankYou } }
			: {}),
		...(rsvp
			? {
				rsvp: {
					variant: 'standard',
					...rsvp,
					personalizedAccess: {
						variant: 'standard',
						...(rsvp.personalizedAccess as Record<string, unknown> | undefined),
					},
				},
			}
			: {}),
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
