import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';

export const interludeSchema = z
	.object({
		image: AssetSchema,
		afterSection: z.enum(INVITATION_RENDER_SECTION_KEYS),
		alt: z.string().optional(),
		height: z.enum(['screen', 'tall', 'medium']).default('screen'),
		// `framed` shows the whole photograph inside a paper margin and hairline frame, so marks
		// near the edges (photographer watermarks, handwritten dates) are never cropped.
		presentation: z.enum(['bleed', 'framed']).optional(),
		focalPoint: focalPointSchema.optional(),
		focalPointDesktop: focalPointSchema.optional(),
		lightX: z.string().optional(),
		lightY: z.string().optional(),
		overlayOpacity: z.string().optional(),
	})
	.strict();

export const interludesSchema = z.array(interludeSchema).optional();

export type InterludeInput = z.infer<typeof interludeSchema>;
