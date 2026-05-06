import { z } from 'zod';
import { HERO_LAYOUT_VARIANTS, PREMIUM_THEMES } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const heroSchema = z.object({
	name: z.string(),
	secondaryName: z.string().optional(),
	label: z.string().optional(),
	nickname: z.string().optional(),
	date: z.iso.datetime(),
	backgroundImage: AssetSchema,
	portrait: AssetSchema.optional(),
	variant: z.enum(PREMIUM_THEMES).optional(),
	layoutVariant: z.enum(HERO_LAYOUT_VARIANTS).optional(),
});
