import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { CONTENT_SECTION_KEYS } from '@/lib/theme/theme-contract';

export const interludeSchema = z.object({
	image: AssetSchema,
	afterSection: z.enum(CONTENT_SECTION_KEYS),
	alt: z.string().optional(),
	height: z.enum(['screen', 'tall', 'medium']).default('screen'),
	variant: z.enum(THEME_PRESETS).optional(),
	focalPoint: focalPointSchema.optional(),
	lightX: z.string().optional(),
	lightY: z.string().optional(),
	overlayOpacity: z.string().optional(),
});

export const interludesSchema = z.array(interludeSchema).optional();

export type InterludeData = z.infer<typeof interludeSchema>;
export type InterludeInput = z.infer<typeof interludeSchema>;
