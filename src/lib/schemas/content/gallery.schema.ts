import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import {
	GALLERY_LAYOUT_ROLES,
	GALLERY_PRESENTATIONS,
	assertSupportedGalleryPresentation,
} from '@/lib/invitation/presentation-options';

export const gallerySchema = z
	.object({
		eyebrow: z.string().max(200).default('Galería'),
		title: z.string().default('Galería'),
		subtitle: z.string().optional(),
		variant: z.union([z.enum(THEME_PRESETS), z.literal('single')]).optional(),
		presentation: z.enum(GALLERY_PRESENTATIONS).optional(),
		items: z.array(
			z.object({
				key: z.string().min(1).max(120).optional(),
				layoutRole: z.enum(GALLERY_LAYOUT_ROLES).optional(),
				aspectRatio: z.string().min(1).max(32).optional(),
				image: AssetSchema,
				alt: z.string().min(1).max(500).optional(),
				caption: z.string().optional(),
				focalPoint: focalPointSchema.optional(),
				focalPointMobile: focalPointSchema.optional(),
				focalPointTablet: focalPointSchema.optional(),
				focalPointDesktop: focalPointSchema.optional(),
			}),
		),
	})
	.superRefine((gallery, context) => {
		try {
			assertSupportedGalleryPresentation(gallery.presentation, gallery.items);
		} catch (error) {
			context.addIssue({
				code: 'custom',
				path: ['presentation'],
				message: error instanceof Error ? error.message : 'Presentación de galería no compatible.',
			});
		}
	})
	.optional();
