import { z } from 'zod';
import { ITINERARY_VARIANTS, THEME_PRESETS } from '@/lib/theme/theme-contract';
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
				/**
				 * Legacy only. Canonical owner is
				 * `location.presentationOptions.showFlourishes`. Kept optional
				 * (no default) so schema parse does not re-inject a conflicting value.
				 */
				showFlourishes: z.boolean().optional(),
				showNavigationButtons: z.boolean().default(true),
			})
			.strict()
			.optional(),
		family: variantOnlySectionStyleSchema.optional(),
		gifts: variantOnlySectionStyleSchema.optional(),
		gallery: variantOnlySectionStyleSchema.optional(),
		itinerary: z
			.object({
				variant: z.enum(ITINERARY_VARIANTS).optional(),
			})
			.strict()
			.optional(),
		thankYou: variantOnlySectionStyleSchema.optional(),
		footer: variantOnlySectionStyleSchema.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.strict()
	.optional();
