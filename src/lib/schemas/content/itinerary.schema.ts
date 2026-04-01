import { z } from 'astro:content';

export const ITINERARY_ICON_KEYS = [
	'waltz',
	'dinner',
	'toast',
	'cake',
	'party',
	'ceremony',
	'doll',
	'church',
	'reception',
	'music',
	'photo',
	'boot',
	'heel',
	'western-hat',
	'taco',
	'tuba',
	'accordion',
] as const;

export const itineraryItemSchema = z.object({
	icon: z.enum(ITINERARY_ICON_KEYS),
	label: z.string(),
	description: z.string().optional(),
	time: z.string(),
});

export const itinerarySchema = z
	.object({
		title: z.string().default('Itinerario'),
		items: z.array(itineraryItemSchema),
	})
	.optional();
