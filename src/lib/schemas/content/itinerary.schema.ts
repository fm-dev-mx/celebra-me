import { z } from 'zod';
import { iconNamesTuple } from '@/lib/icons/icon-catalog';

const ICON_NAMES_TUPLE = iconNamesTuple();

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
		items: z.array(itineraryItemSchema),
	})
	.optional();
