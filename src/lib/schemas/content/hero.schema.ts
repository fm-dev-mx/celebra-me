import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { HERO_TIME_FORMATS } from '@/lib/invitation/hero-presentation';
import { HERO_VARIANTS } from '@/lib/invitation/section-variants';

/** Pinned scroll scenes the standard cover can play (docs/domains/theme/motion.md). */
export const HERO_SCENES = ['cover-approach'] as const;
export type HeroScene = (typeof HERO_SCENES)[number];

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
				// Editorial-cover folio marks (watermark and page rail). The renderer keeps its
				// XV defaults when they are omitted.
				coverMark: z.string().trim().min(1).max(8).optional(),
				coverPage: z.string().trim().min(1).max(16).optional(),
				// Editorial-cover design credit line; shown unless explicitly disabled.
				designCredit: z.boolean().optional(),
				// Clock shown under the cover date: `24h` (default, as written) or `12h` (`7:00 p. m.`).
				timeFormat: z.enum(HERO_TIME_FORMATS).optional(),
				// Standard cover only: the cover stays pinned while the picture closes in on its focus.
				scene: z.enum(HERO_SCENES).optional(),
			})
			.strict()
			.optional(),
		variant: z.enum(HERO_VARIANTS),
		focalPoint: focalPointSchema.optional(),
		focalPointMobile: focalPointSchema.optional(),
		focalPointTablet: focalPointSchema.optional(),
		focalPointDesktop: focalPointSchema.optional(),
	})
	.strict()
	.superRefine((hero, context) => {
		const scene = hero.presentation?.scene;
		if (!scene || hero.variant === 'standard') return;
		context.addIssue({
			code: 'custom',
			path: ['presentation', 'scene'],
			message: `hero.presentation.scene=${scene} requires the standard variant`,
		});
	});
