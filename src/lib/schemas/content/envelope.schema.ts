import { z } from 'zod';
import { ColorTokenSchema } from '@/lib/schemas/content/shared.schema';
import { XARENI_SEAL_COLORS } from '@/lib/invitation/presentation-options';

export const envelopeSchema = z
	.object({
		disabled: z.boolean().optional().default(false),
		sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).default('wax'),
		sealIcon: z.enum(['boot', 'heart', 'monogram', 'flower', 'special-edition']).optional(),
		sealInitials: z.string().max(4).optional(),
		sealColor: z.enum(XARENI_SEAL_COLORS).optional(),
		sealVariant: z.enum(['premium-rose']).optional(),
		cardLabel: z.string().trim().max(60).optional(),
		envelopeName: z.string().trim().max(200).optional(),
		cardName: z.string().trim().max(200).optional(),
		cardSecondaryName: z.string().trim().max(200).optional(),
		cardTagline: z.string().trim().max(120).optional(),
		guestLabel: z.string().trim().max(80).optional(),
		guestNameFallback: z.string().trim().max(200).optional(),
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
		revealVariant: z.enum(['editorial-cover']).optional(),
		coverEdition: z.string().optional(),
		coverVolume: z.string().optional(),
		coverIssue: z.string().optional(),
	})
	.passthrough() // Preserva campos desconocidos del envelope (defensivo para datos DB legacy)
	.optional();
