import { z } from 'zod';

/** Explicit delivery intent; omission retains the existing caller defaults. */
export const ImageDeliverySchema = z
	.object({
		mode: z.enum(['original', 'optimized']),
		width: z.number().int().min(1).max(8192).optional(),
		height: z.number().int().min(1).max(8192).optional(),
		quality: z.number().int().min(1).max(100).optional(),
		format: z.enum(['avif', 'jpeg', 'png', 'webp']).optional(),
	})
	.strict()
	.refine(
		(value) =>
			value.mode !== 'original' ||
			(value.quality === undefined && value.format === undefined),
		{
			message: 'Original delivery cannot request encoding transformations.',
		},
	);

export type ImageDelivery = z.infer<typeof ImageDeliverySchema>;
