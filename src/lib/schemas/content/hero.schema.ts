import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';

export const heroSchema = z.object({
	name: z.string(),
	secondaryName: z.string().optional(),
	label: z.string().optional(),
	nickname: z.string().optional(),
	date: z.iso.datetime(),
	backgroundImage: AssetSchema,
	backgroundImageDesktop: AssetSchema.optional(),
	focalPoint: focalPointSchema.optional(),
	focalPointMobile: focalPointSchema.optional(),
	focalPointTablet: focalPointSchema.optional(),
	focalPointDesktop: focalPointSchema.optional(),
});
