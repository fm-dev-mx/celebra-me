import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { COUNTDOWN_VARIANTS } from '@/lib/invitation/section-variants';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';

/** Legacy theme-named style variants retained only until writers stop emitting them. */
const legacyThemeOrStandardVariant = z.enum([...THEME_PRESETS, 'standard']).optional();

const variantOnlySectionStyleSchema = z
	.object({
		variant: legacyThemeOrStandardVariant,
	})
	.strict();

export const sectionStylesSchema = z
	.object({
		quote: variantOnlySectionStyleSchema.optional(),
		countdown: z
			.object({
				variant: z.enum([...COUNTDOWN_VARIANTS, ...THEME_PRESETS]).optional(),
			})
			.strict()
			.optional(),
		location: z
			.object({
				variant: legacyThemeOrStandardVariant,
			})
			.strict()
			.optional(),
		family: variantOnlySectionStyleSchema.optional(),
		gifts: z
			.object({
				variant: legacyThemeOrStandardVariant,
			})
			.strict()
			.optional(),
		thankYou: z
			.object({
				variant: legacyThemeOrStandardVariant,
			})
			.strict()
			.optional(),
		footer: variantOnlySectionStyleSchema.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.strict()
	.optional();
