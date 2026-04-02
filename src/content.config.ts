import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const eventsCollection = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/events' }),
	schema: eventContentSchema,
});

const eventDemosCollection = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/event-demos' }),
	schema: eventContentSchema,
});

const eventTemplatesCollection = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/event-templates' }),
	schema: eventContentSchema,
});

export const collections = {
	events: eventsCollection,
	'event-demos': eventDemosCollection,
	'event-templates': eventTemplatesCollection,
};
