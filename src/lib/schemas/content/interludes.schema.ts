import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';
import { CONTENT_SECTION_KEYS } from '@/lib/adapters/types';

export const interludeSchema = z.object({
	image: AssetSchema,
	afterSection: z.enum(CONTENT_SECTION_KEYS),
	alt: z.string().optional(),
	height: z.enum(['screen', 'tall']).default('screen'),
	variant: z.enum(THEME_PRESETS).optional(),
	focalPoint: z.string().optional(),
});

export const interludesSchema = z.array(interludeSchema).optional();

export type InterludeData = z.infer<typeof interludeSchema>;
export type InterludeInput = z.infer<typeof interludeSchema>;
