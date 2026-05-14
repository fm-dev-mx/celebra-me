import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';

export const heroSchema = z.object({
	name: z.string(),
	secondaryName: z.string().optional(),
	label: z.string().optional(),
	nickname: z.string().optional(),
	date: z.iso.datetime(),
	backgroundImage: AssetSchema,
	focalPoint: z
		.string()
		.regex(/^\d+\s*%\s*\d+\s*%$/, 'focalPoint must be in format "X% Y%"')
		.optional(),
});
