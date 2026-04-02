import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { ColorTokenSchema } from '@/lib/schemas/content/shared.schema';

export const envelopeSchema = z
	.object({
		disabled: z.boolean().optional().default(false),
		sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).default('wax'),
		sealIcon: z.enum(['boot', 'heart', 'monogram', 'flower', 'special-edition']).optional(),
		microcopy: z.string().default('Toca para abrir mi invitación'),
		documentLabel: z.string().optional(),
		stampText: z.string().optional(),
		stampYear: z.string().optional(),
		tooltipText: z.string().optional(),
		closedPalette: z
			.object({
				primary: ColorTokenSchema.optional(),
				accent: ColorTokenSchema.optional(),
				background: ColorTokenSchema.optional(),
			})
			.optional(),
		variant: z.enum(THEME_PRESETS).optional(),
	})
	.optional();
