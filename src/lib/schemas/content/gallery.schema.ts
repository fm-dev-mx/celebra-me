import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import {
	GALLERY_LAYOUT_ROLES,
	GALLERY_MOBILE_BROWSE_MODES,
	GALLERY_PRESENTATIONS,
	assertSupportedGalleryPresentation,
} from '@/lib/invitation/presentation-options';
import { GALLERY_VARIANTS } from '@/lib/invitation/section-variants';

export const gallerySchema = z
	.object({
		eyebrow: z.string().max(200).default('Galería'),
		title: z.string().default('Galería'),
		subtitle: z.string().optional(),
		variant: z.enum(GALLERY_VARIANTS),
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
	.strict()
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

		if (gallery.variant === 'single-keepsake' && gallery.items.length !== 1) {
			context.addIssue({
				code: 'custom',
				path: ['items'],
				message: 'gallery.variant=single-keepsake requires exactly one gallery item',
			});
		}

		if (gallery.variant === 'feature-stack' && gallery.items.length < 3) {
			context.addIssue({
				code: 'custom',
				path: ['items'],
				message: 'gallery.variant=feature-stack requires at least three gallery items',
			});
		}

		if (gallery.variant === 'paired-feature-band') {
			const hasFeatureRole = gallery.items.some((item) => item.layoutRole === 'feature');
			if (!hasFeatureRole) {
				context.addIssue({
					code: 'custom',
					path: ['items'],
					message:
						'gallery.variant=paired-feature-band requires at least one item with layoutRole=feature',
				});
			}
			if (gallery.items.length < 3) {
				context.addIssue({
					code: 'custom',
					path: ['items'],
					message:
						'gallery.variant=paired-feature-band requires at least three gallery items',
				});
			}
		}
	})
	.optional();
