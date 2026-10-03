import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const eventDemosCollection = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/event-demos' }),
	schema: eventContentSchema,
});

export const collections = {
	'event-demos': eventDemosCollection,
};
