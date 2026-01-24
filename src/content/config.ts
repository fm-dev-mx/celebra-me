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
		family: z
			.object({
				parents: z.object({
					father: z.string().optional(),
					mother: z.string().optional(),
				}),
				godparents: z
					.array(
						z.object({
							name: z.string(),
							role: z.string().optional(),
						}),
					)
					.optional(),
				featuredImage: z.string().optional(),
			})
			.optional(),
		rsvp: z
			.object({
				title: z.string().default('¿Vienes a celebrar conmigo?'),
				guestCap: z.number().int().positive().default(1),
				confirmationMessage: z
					.string()
					.default('¡Gracias por confirmar! Te esperamos con mucha emoción.'),
			})
			.optional(),
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
