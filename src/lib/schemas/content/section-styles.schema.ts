import { z } from 'zod';
import { ITINERARY_VARIANTS, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';
import {
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	THANK_YOU_STRUCTURAL_VARIANTS,
} from '@/lib/invitation/structural-variants';

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
		gifts: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				structuralVariant: z.enum(GIFTS_STRUCTURAL_VARIANTS).optional(),
			})
			.strict()
			.optional(),
		gallery: z
			.object({
				variant: z
					.union([
						z.enum(GALLERY_LAYOUT_VARIANTS),
						z.enum(THEME_PRESETS),
						z.literal('single'),
					])
					.optional(),
			})
			.strict()
			.optional(),
		itinerary: z
			.object({
				variant: z.enum(ITINERARY_VARIANTS).optional(),
			})
			.strict()
			.optional(),
		thankYou: z
			.object({
				variant: z.enum(THEME_PRESETS).optional(),
				structuralVariant: z.enum(THANK_YOU_STRUCTURAL_VARIANTS).optional(),
			})
			.strict()
			.optional(),
		footer: variantOnlySectionStyleSchema.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.strict()
	.optional();
