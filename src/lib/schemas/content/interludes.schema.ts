import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { CONTENT_SECTION_KEYS } from '@/lib/theme/theme-contract';

export const interludeSchema = z.object({
	image: AssetSchema,
	afterSection: z.enum(CONTENT_SECTION_KEYS),
	alt: z.string().optional(),
	height: z.enum(['screen', 'tall', 'medium']).default('screen'),
	focalPoint: focalPointSchema.optional(),
	focalPointDesktop: focalPointSchema.optional(),
	lightX: z.string().optional(),
	lightY: z.string().optional(),
	overlayOpacity: z.string().optional(),
}).strict();

export const interludesSchema = z.array(interludeSchema).optional();

export type InterludeInput = z.infer<typeof interludeSchema>;
