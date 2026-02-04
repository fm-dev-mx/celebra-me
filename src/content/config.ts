// src/content/config.ts

import { defineCollection, z } from 'astro:content';

// Just adding image context
const eventsCollection = defineCollection({
	type: 'data',
	schema: ({ image }) =>
		z.object({
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
				backgroundImage: image(),
			}),
			location: z.object({
				venueName: z.string(),
				address: z.string(),
				city: z.string(),
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
					featuredImage: image().optional(),
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
			// Quote section for inspirational/personalized phrases
			quote: z
				.object({
					text: z.string(),
					author: z.string().optional(),
				})
				.optional(),
			// Thank you / closing section
			thankYou: z
				.object({
					message: z.string(),
					closingName: z.string(),
					image: image().optional(),
				})
				.optional(),
			// Background music / ambient audio
			music: z
				.object({
					url: z.string(),
					autoPlay: z.boolean().default(false),
					title: z.string().optional(), // For accessibility (aria-label)
				})
				.optional(),
			// Flexible object for optional sections (RSVP, etc.)
			sections: z
				.object({
					countdown: z.boolean().default(true),
					rsvp: z.boolean().default(true),
					gifts: z.boolean().default(false),
					gallery: z.boolean().default(false),
				})
				.optional(),
			envelope: z
				.object({
					disabled: z.boolean().optional().default(false),
					sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).default('wax'),
					microcopy: z.string().default('Toca para abrir mi invitación'),
					closedPalette: z.object({
						primary: z.string().regex(/^#/, 'Must be a hex color'),
						accent: z.string().regex(/^#/, 'Must be a hex color'),
						background: z.string().regex(/^#/, 'Must be a hex color'),
					}),
				})
				.optional(),
		}),
});

export const collections = {
	events: eventsCollection,
};
