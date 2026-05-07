import { z } from 'zod';
import { ITINERARY_ICON_KEYS } from '@/lib/adapters/types';

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
