import { z } from 'zod';
import {
	COUNTDOWN_NUMBER_STYLES,
	LOCATION_MAP_STYLES,
	PREMIUM_THEMES,
	QUOTE_ANIMATIONS,
	QUOTE_FONT_STYLES,
} from '@/lib/theme/theme-contract';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';

export const sectionStylesSchema = z
	.object({
		quote: z
			.object({
				variant: z.enum(PREMIUM_THEMES).optional(),
				fontStyle: z.enum(QUOTE_FONT_STYLES).optional(),
				animation: z.enum(QUOTE_ANIMATIONS).default('fade'),
			})
			.optional(),
		countdown: z
			.object({
				variant: z.enum(PREMIUM_THEMES).optional(),
				numberStyle: z.enum(COUNTDOWN_NUMBER_STYLES).default('thin'),
				showParticles: z.boolean().default(false),
			})
			.optional(),
		location: z
			.object({
				variant: z.enum(PREMIUM_THEMES).optional(),
				mapStyle: z.enum(LOCATION_MAP_STYLES).default('dark'),
				showFlourishes: z.boolean().default(true),
			})
			.optional(),
		family: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		gifts: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		gallery: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		itinerary: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		thankYou: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		footer: z.object({ variant: z.enum(PREMIUM_THEMES).optional() }).optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.optional();
