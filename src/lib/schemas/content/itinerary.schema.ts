import { z } from 'zod';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { ITINERARY_VARIANTS } from '@/lib/invitation/section-variants';

export const itineraryItemSchema = z.object({
	iconName: z.enum(ICON_NAMES_TUPLE),
	label: z.string(),
	description: z.string().optional(),
	time: z.string(),
});

export const itinerarySchema = z
	.object({
		title: z.string().default('Itinerario'),
		subtitle: z.string().optional(),
		variant: z.enum(ITINERARY_VARIANTS),
		items: z.array(itineraryItemSchema),
	})
	.optional();
