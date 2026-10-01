import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { HERO_VARIANTS } from '@/lib/invitation/section-variants';

export const heroSchema = z
	.object({
		name: z.string(),
		secondaryName: z.string().optional(),
		label: z.string().optional(),
		nickname: z.string().optional(),
		scrollLabel: z.string().max(80).optional(),
		// Editorial-cover copy; each renders only when provided.
		tagline: z.string().max(160).optional(),
		photoCredit: z.string().max(80).optional(),
		date: z.iso.datetime(),
		backgroundImage: AssetSchema,
		backgroundImageDesktop: AssetSchema.optional(),
		backgroundImageMobile: AssetSchema.optional(),
		portrait: AssetSchema.optional(),
		ornament: AssetSchema.optional(),
		accentOrnament: AssetSchema.optional(),
		ambience: AssetSchema.optional(),
		presentation: z
			.object({
				portraitEnabled: z.boolean().optional(),
				venueIndex: z.number().int().nonnegative().optional(),
				// Leading words of `name` set as the display line; the rest follows as a
				// secondary line. Presentation only: `name` stays whole everywhere else.
				nameLeadWords: z.number().int().min(1).max(4).optional(),
			})
			.strict()
			.optional(),
		variant: z.enum(HERO_VARIANTS),
		focalPoint: focalPointSchema.optional(),
		focalPointMobile: focalPointSchema.optional(),
		focalPointTablet: focalPointSchema.optional(),
		focalPointDesktop: focalPointSchema.optional(),
	})
	.strict();
