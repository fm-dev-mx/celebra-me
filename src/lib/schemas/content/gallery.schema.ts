import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import {
	GALLERY_LAYOUT_ROLES,
	GALLERY_MOBILE_BROWSE_MODES,
	GALLERY_PRESENTATIONS,
	assertSupportedGalleryPresentation,
} from '@/lib/invitation/presentation-options';
import { GALLERY_LAYOUT_VARIANTS } from '@/lib/invitation/structural-variants';

export const gallerySchema = z
	.object({
		eyebrow: z.string().max(200).default('Galería'),
		title: z.string().default('Galería'),
		subtitle: z.string().optional(),
		variant: z.enum(GALLERY_LAYOUT_VARIANTS),
		visualVariant: z.enum(THEME_PRESETS).optional(),
		presentation: z.enum(GALLERY_PRESENTATIONS).optional(),
		presentationOptions: z
			.object({
				mobileBrowse: z.enum(GALLERY_MOBILE_BROWSE_MODES).optional(),
			})
			.strict()
			.optional(),
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
				message:
					error instanceof Error
						? error.message
						: 'Presentación de galería no compatible.',
			});
		}
	})
	.optional();
