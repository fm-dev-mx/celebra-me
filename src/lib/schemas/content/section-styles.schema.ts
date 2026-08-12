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
		countdown: variantOnlySectionStyleSchema.optional(),
		location: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
			})
			.strict()
			.optional(),
		family: variantOnlySectionStyleSchema.optional(),
		gifts: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
			})
			.strict()
			.optional(),
		thankYou: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
			})
			.strict()
			.optional(),
		footer: variantOnlySectionStyleSchema.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.strict()
	.optional();
