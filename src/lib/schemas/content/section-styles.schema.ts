import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';

const variantOnlySectionStyleSchema = z
	.object({
		variant: z.enum(THEME_PRESETS).optional(),
	})
	.strict();

export const sectionStylesSchema = z
	.object({
		quote: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
			})
			.strict()
			.optional(),
		countdown: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				showParticles: z.boolean().default(false),
			})
			.strict()
			.optional(),
		location: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				showFlourishes: z.boolean().default(true),
			})
			.strict()
			.optional(),
		family: variantOnlySectionStyleSchema.optional(),
		gifts: variantOnlySectionStyleSchema.optional(),
		gallery: variantOnlySectionStyleSchema.optional(),
		itinerary: variantOnlySectionStyleSchema.optional(),
		thankYou: variantOnlySectionStyleSchema.optional(),
		footer: variantOnlySectionStyleSchema.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.strict()
	.optional();
