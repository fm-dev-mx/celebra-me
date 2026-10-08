import { z } from 'zod';
import { AssetSchema, ColorTokenSchema } from '@/lib/schemas/content/shared.schema';
import { ENVELOPE_SEAL_COLORS } from '@/lib/invitation/reveal-card';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

export const envelopeRevealVariantSchema = z.enum([
	'celestial-blue',
	'editorial-cover',
	'satin-filigree',
]);
export type EnvelopeRevealVariant = z.infer<typeof envelopeRevealVariantSchema>;

/** Editorial cover experience: 'collector' adds the drag-to-open bending magazine. */
export const editorialCoverExperienceSchema = z.enum(['standard', 'collector']);
export type EditorialCoverExperience = z.infer<typeof editorialCoverExperienceSchema>;

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
		backdropImage: AssetSchema.optional(),
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
		// Collector rail label printed before coverEdition ("NÚM." when omitted); an empty string
		// prints the edition alone, e.g. "3 años".
		coverEditionLabel: z.string().trim().max(16).optional(),
		coverVolume: z.string().optional(),
		coverIssue: z.string().optional(),
		// Editorial cover: one or two short cover lines; the reveal keeps its defaults when omitted.
		coverLines: z.array(z.string().trim().min(1).max(60)).min(1).max(2).optional(),
		coverExperience: editorialCoverExperienceSchema.optional(),
		// Collector edition cutouts: one on the printed cover face, up to two on the first inner
		// page. Transparent images in token-sized contained boxes; absent, nothing renders.
		coverOrnament: AssetSchema.optional(),
		spreadOrnaments: z.array(AssetSchema).min(1).max(2).optional(),
	})
	.loose() // Preserva campos desconocidos del envelope (defensivo para datos DB legacy)
	.optional();
