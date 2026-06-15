import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';

export const gallerySchema = z
	.object({
		eyebrow: z.string().max(200).default('Galería'),
		title: z.string().default('Galería'),
		subtitle: z.string().optional(),
		variant: z.union([z.enum(THEME_PRESETS), z.literal('single')]).optional(),
		presentation: z.enum(['pet-keepsake']).optional(),
		items: z.array(
			z.object({
				image: AssetSchema,
				caption: z.string().optional(),
				focalPoint: focalPointSchema.optional(),
				focalPointMobile: focalPointSchema.optional(),
				focalPointTablet: focalPointSchema.optional(),
				focalPointDesktop: focalPointSchema.optional(),
			}),
		),
	})
	.optional();
