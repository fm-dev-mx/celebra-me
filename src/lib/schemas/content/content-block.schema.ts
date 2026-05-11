import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';
import { CONTENT_SECTION_KEYS } from '@/lib/adapters/types';

export const contentBlocksSchema = z
	.array(
		z.discriminatedUnion('type', [
			z.object({ type: z.literal('section'), section: z.enum(CONTENT_SECTION_KEYS) }),
			z.object({
				type: z.literal('interlude'),
				image: AssetSchema,
				alt: z.string().optional(),
				height: z.enum(['screen', 'tall']).default('screen'),
				variant: z.enum(THEME_PRESETS).optional(),
				focalPoint: z.string().optional(),
			}),
		]),
	)
	.optional();

export type ContentBlockData = NonNullable<
	ReturnType<(typeof contentBlocksSchema)['parse']>
>[number];
