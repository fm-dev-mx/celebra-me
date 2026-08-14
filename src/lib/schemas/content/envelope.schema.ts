import { z } from 'zod';
import { AssetSchema, ColorTokenSchema } from '@/lib/schemas/content/shared.schema';
import { ENVELOPE_SEAL_COLORS } from '@/lib/invitation/reveal-card';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

export const envelopeRevealVariantSchema = z.enum(['celestial-blue', 'editorial-cover']);
export type EnvelopeRevealVariant = z.infer<typeof envelopeRevealVariantSchema>;

export const envelopeSchema = z
	.object({
		disabled: z.boolean().optional().default(false),
		variant: z.enum(THEME_PRESETS).optional(),
		sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).default('wax'),
		sealIcon: z
			.enum([
				'boot',
				'heart',
				'monogram',
				'wax-monogram',
				'wax-organic',
				'wax-medallion',
				'flower',
				'special-edition',
			])
			.optional(),
		sealInitials: z.string().max(4).optional(),
		sealColor: z.enum(ENVELOPE_SEAL_COLORS).optional(),
		sealVariant: z.enum(['wax-organic', 'wax-medallion', 'premium-rose']).optional(),
		sealImage: AssetSchema.optional(),
		cardLabel: z.string().trim().max(60).optional(),
		envelopeName: z.string().trim().max(200).optional(),
		cardName: z.string().trim().max(200).optional(),
		cardSecondaryName: z.string().trim().max(200).optional(),
		cardTagline: z.string().trim().max(120).optional(),
		guestLabel: z.string().trim().max(80).optional(),
		guestNameFallback: z.string().trim().max(200).optional(),
		guestPlacement: z.enum(['inside-envelope', 'outside-envelope']).optional(),
		microcopy: z.string().default('Toca para abrir mi invitación'),
		documentLabel: z.string().optional(),
		stampText: z.string().optional(),
		stampYear: z.string().optional(),
		tooltipText: z.string().optional(),
		teaserDetails: z.string().trim().max(500).optional(),
		closedPalette: z
			.object({
				primary: ColorTokenSchema.optional(),
				accent: ColorTokenSchema.optional(),
				background: ColorTokenSchema.optional(),
			})
			.optional(),
		revealVariant: envelopeRevealVariantSchema.optional(),
		coverEdition: z.string().optional(),
		coverVolume: z.string().optional(),
		coverIssue: z.string().optional(),
	})
	.loose() // Preserva campos desconocidos del envelope (defensivo para datos DB legacy)
	.optional();
