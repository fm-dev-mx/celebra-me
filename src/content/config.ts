// src/content/config.ts

import { defineCollection, z } from 'astro:content';

const eventsCollection = defineCollection({
	type: 'data', // JSON/YAML files
	schema: z.object({
		eventType: z.enum(['xv', 'boda', 'bautizo']),
		title: z.string(),
		description: z.string().optional(),
		theme: z.object({
			primaryColor: z.string().regex(/^#/, 'Must be a hex color'),
			accentColor: z.string().regex(/^#/, 'Must be a hex color').optional(),
			fontFamily: z.enum(['serif', 'sans']).default('serif'),
		}),
		hero: z.object({
			name: z.string(),
			date: z.string().datetime(), // ISO 8601
			backgroundImage: z.string(),
		}),
		location: z.object({
			venueName: z.string(),
			address: z.string(),
			mapUrl: z.string().url().optional(),
		}),
		// Flexible object for optional sections (RSVP, etc.)
		sections: z
			.object({
				countdown: z.boolean().default(true),
				rsvp: z.boolean().default(true),
				gifts: z.boolean().default(false),
			})
			.optional(),
	}),
});

export const collections = {
	events: eventsCollection,
};
