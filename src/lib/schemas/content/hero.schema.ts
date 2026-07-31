import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

export const heroSchema = z
	.object({
		name: z.string(),
		secondaryName: z.string().optional(),
		label: z.string().optional(),
		nickname: z.string().optional(),
		scrollLabel: z.string().max(80).optional(),
		date: z.iso.datetime(),
		backgroundImage: AssetSchema,
		backgroundImageDesktop: AssetSchema.optional(),
		backgroundImageMobile: AssetSchema.optional(),
		portrait: AssetSchema.optional(),
		presentation: z
			.object({
				portraitEnabled: z.boolean().optional(),
			})
			.strict()
			.optional(),
		variant: z.enum(THEME_PRESETS).optional(),
		focalPoint: focalPointSchema.optional(),
		focalPointMobile: focalPointSchema.optional(),
		focalPointTablet: focalPointSchema.optional(),
		focalPointDesktop: focalPointSchema.optional(),
	})
	.strict();
