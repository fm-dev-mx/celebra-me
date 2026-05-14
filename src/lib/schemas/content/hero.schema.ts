import { z } from 'zod';
import { AssetSchema, focalPointPairSchema } from '@/lib/schemas/content/shared.schema';

export const heroSchema = z.object({
	name: z.string(),
	secondaryName: z.string().optional(),
	label: z.string().optional(),
	nickname: z.string().optional(),
	date: z.iso.datetime(),
	backgroundImage: AssetSchema,
	focalPoint: focalPointPairSchema.optional(),
});
