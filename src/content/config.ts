// src/content/config.ts

import { defineCollection, z } from 'astro:content';

// Just adding image context
const eventsCollection = defineCollection({
	type: 'data',
	schema: ({ image }) =>
		z.object({
			eventType: z.enum(['xv', 'boda', 'bautizo', 'cumple']),
			isDemo: z.boolean().optional(),
			title: z.string(),
			description: z.string().optional(),
			theme: z.object({
				primaryColor: z.string().regex(/^#/, 'Must be a hex color'),
				accentColor: z.string().regex(/^#/, 'Must be a hex color').optional(),
				fontFamily: z.enum(['serif', 'sans']).default('serif'),
				preset: z.enum(['jewelry-box', 'luxury-hacienda']).optional(),
			}),
			hero: z.object({
				name: z.string(),
				nickname: z.string().optional(),
				date: z.string().datetime(), // ISO 8601
				backgroundImage: image(),
				portrait: image().optional(), // ADU-8: Optional celebrant portrait
			}),
			location: z.object({
				// Base venue info (backward compatible)
				venueName: z.string(),
				address: z.string(),
				city: z.string(),
				mapUrl: z.string().url().optional(),

				// Extended: Ceremony venue (optional, for XV/wedding with church)
				ceremony: z
					.object({
						venueName: z.string(),
						address: z.string(),
						date: z.string(),
						time: z.string(),
						mapUrl: z.string().url().optional(),
						appleMapsUrl: z.string().url().optional(),
						googleMapsUrl: z.string().url().optional(),
						image: z.string().optional(),
						coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
					})
					.optional(),

				// Extended: Reception venue with itinerary
				reception: z
					.object({
						venueName: z.string(),
						address: z.string(),
						date: z.string(),
						time: z.string(),
						mapUrl: z.string().url().optional(),
						appleMapsUrl: z.string().url().optional(),
						googleMapsUrl: z.string().url().optional(),
						image: z.string().optional(),
						coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
						itinerary: z
							.array(
								z.object({
									icon: z.enum(['waltz', 'dinner', 'toast', 'cake', 'party']),
									label: z.string(),
									time: z.string(),
								}),
							)
							.optional(),
					})
					.optional(),

				// Event indications (dress code, gifts policy, etc.)
				indications: z
					.array(
						z.object({
							icon: z.enum(['crown', 'envelope', 'forbidden', 'dress', 'gift']),
							text: z.string(),
						}),
					)
					.optional(),
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
			music: z
				.object({
					url: z.string(),
					autoPlay: z.boolean().default(false),
					title: z.string().optional(), // For accessibility (aria-label)
				})
				.optional(),
			sections: z
				.object({
					countdown: z.boolean().default(true),
					rsvp: z.boolean().default(true),
					gifts: z.boolean().default(false),
					gallery: z.boolean().default(false),
				})
				.optional(),
			gallery: z
				.object({
					title: z.string().default('Galería'),
					subtitle: z.string().optional(),
					items: z.array(
						z.object({
							image: image(),
							caption: z.string().optional(),
						}),
					),
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
			itinerary: z
				.object({
					title: z.string().default('Itinerario'),
					items: z.array(
						z.object({
							icon: z.enum([
								'waltz',
								'dinner',
								'toast',
								'cake',
								'party',
								'church',
								'reception',
								'music',
								'photo',
							]),
							label: z.string(),
							description: z.string().optional(),
							time: z.string(),
						}),
					),
				})
				.optional(),
			gifts: z
				.array(
					z.discriminatedUnion('type', [
						z.object({
							type: z.literal('store'),
							name: z.string(),
							url: z.string().url(),
							logo: z.string().optional(),
						}),
						z.object({
							type: z.literal('bank'),
							bankName: z.string(),
							accountHolder: z.string(),
							clabe: z.string(),
							accountNumber: z.string().optional(),
						}),
						z.object({
							type: z.literal('paypal'),
							url: z.string().url(),
						}),
						z.object({
							type: z.literal('cash'),
							text: z.string().optional(),
						}),
					]),
				)
				.optional(),
			countdown: z
				.object({
					title: z.string().default('¡Falta muy poco!'),
					subtitlePrefix: z.string().default('El'),
					footerText: z.string().default('Prepárate para una noche inolvidable'),
				})
				.optional(),
			navigation: z
				.array(
					z.object({
						label: z.string(),
						href: z.string(),
					}),
				)
				.optional(),
		}),
});

export const collections = {
	events: eventsCollection,
};
