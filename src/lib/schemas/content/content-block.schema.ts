import { z } from 'zod';
import { SHARED_SECTION_VARIANTS } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const CONTENT_SECTION_KEYS = [
	'quote',
	'countdown',
	'location',
	'family',
	'itinerary',
	'gallery',
	'rsvp',
	'gifts',
	'thankYou',
] as const;

export const contentBlocksSchema = z
	.array(
		z.discriminatedUnion('type', [
			z.object({ type: z.literal('section'), section: z.enum(CONTENT_SECTION_KEYS) }),
			z.object({
				type: z.literal('interlude'),
				image: AssetSchema,
				alt: z.string().optional(),
				height: z.enum(['screen', 'tall']).default('screen'),
				variant: z.enum(SHARED_SECTION_VARIANTS).optional(),
				focalPoint: z.string().optional(),
			}),
		]),
	)
	.optional();

export type ContentBlockData = NonNullable<
	ReturnType<(typeof contentBlocksSchema)['parse']>
>[number];
