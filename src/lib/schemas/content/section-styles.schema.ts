import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';

export const sectionStylesSchema = z
	.object({
		quote: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
			})
			.optional(),
		countdown: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				showParticles: z.boolean().default(false),
			})
			.optional(),
		location: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				showFlourishes: z.boolean().default(true),
			})
			.optional(),
		family: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		gifts: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		gallery: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		itinerary: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		thankYou: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		footer: z.object({ variant: z.enum(THEME_PRESETS).optional() }).optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.optional();
