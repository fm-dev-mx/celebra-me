import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

/** One folder per demo invitation: `src/invitations/demos/<slug>/content.json`; the folder names the entry. */
const eventDemosCollection = defineCollection({
	loader: glob({
		pattern: '*/content.json',
		base: './src/invitations/demos',
		generateId: ({ entry }) => entry.split('/')[0],
	}),
	schema: eventContentSchema,
});

export const collections = {
	'event-demos': eventDemosCollection,
};
