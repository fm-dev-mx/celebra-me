import { z } from 'astro:content';
import { HERO_LAYOUT_VARIANTS, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const heroSchema = z.object({
	name: z.string(),
	secondaryName: z.string().optional(),
	label: z.string().optional(),
	nickname: z.string().optional(),
	date: z.string().datetime(),
	backgroundImage: AssetSchema,
	portrait: AssetSchema.optional(),
	variant: z.enum(THEME_PRESETS).optional(),
	layoutVariant: z.enum(HERO_LAYOUT_VARIANTS).optional(),
});
