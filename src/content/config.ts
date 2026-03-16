// src/content/config.ts

import { defineCollection } from 'astro:content';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const eventsCollection = defineCollection({
	type: 'data',
	schema: eventContentSchema,
});

const eventDemosCollection = defineCollection({
	type: 'data',
	schema: eventContentSchema,
});

const eventTemplatesCollection = defineCollection({
	type: 'data',
	schema: eventContentSchema,
});

export const collections = {
	events: eventsCollection,
	'event-demos': eventDemosCollection,
	'event-templates': eventTemplatesCollection,
};
