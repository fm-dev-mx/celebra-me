import { z } from 'zod';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const gallerySchema = z
	.object({
		title: z.string().default('Galería'),
		subtitle: z.string().optional(),
		items: z.array(z.object({ image: AssetSchema, caption: z.string().optional() })),
	})
	.optional();
