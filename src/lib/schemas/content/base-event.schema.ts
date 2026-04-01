import { z } from 'astro:content';
import { LOCATION_VARIANT_PRESET_COMPATIBILITY, THEME_PRESETS } from '@/lib/theme/theme-contract';
import { SHARED_SECTION_VARIANTS } from '@/lib/theme/theme-variants';
import { heroSchema } from '@/lib/schemas/content/hero.schema';
import { locationSchema } from '@/lib/schemas/content/location.schema';
import { familySchema } from '@/lib/schemas/content/family.schema';
import { rsvpSchema } from '@/lib/schemas/content/rsvp.schema';
import { giftsSchema } from '@/lib/schemas/content/gifts.schema';
import {
	AssetSchema,
	baseEventFieldsSchema,
	ColorTokenSchema,
	countdownSchema,
	musicSchema,
	navigationSchema,
	quoteSchema,
	sectionsSchema,
	sharingSchema,
	thankYouSchema,
} from '@/lib/schemas/content/shared.schema';
import { sectionStylesSchema } from '@/lib/schemas/content/section-styles.schema';

const CONTENT_SECTION_KEYS = [
	'quote',
	'countdown',
	'location',
	'family',
	'itinerary',
	'gallery',
	'rsvp',
	'gifts',
	'thankYou',
] as const;

export const eventContentSchema = baseEventFieldsSchema
	.extend({
		sectionStyles: sectionStylesSchema,
		hero: heroSchema,
		location: locationSchema,
		family: familySchema,
		rsvp: rsvpSchema,
		quote: quoteSchema,
		thankYou: thankYouSchema,
		music: musicSchema,
		sections: sectionsSchema,
		gallery: z
			.object({
				title: z.string().default('Galería'),
				subtitle: z.string().optional(),
				items: z.array(z.object({ image: AssetSchema, caption: z.string().optional() })),
			})
			.optional(),
		envelope: z
			.object({
				disabled: z.boolean().optional().default(false),
				sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).default('wax'),
				sealIcon: z
					.enum(['boot', 'heart', 'monogram', 'flower', 'special-edition'])
					.optional(),
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
			.optional(),
		itinerary: z
			.object({
				title: z.string().default('Itinerario'),
				items: z.array(
					z.object({
						icon: z.enum([
							'waltz',
							'dinner',
							'toast',
							'cake',
							'party',
							'ceremony',
							'doll',
							'church',
							'reception',
							'music',
							'photo',
							'boot',
							'heel',
							'western-hat',
							'taco',
							'tuba',
							'accordion',
						]),
						label: z.string(),
						description: z.string().optional(),
						time: z.string(),
					}),
				),
			})
			.optional(),
		gifts: giftsSchema,
		countdown: countdownSchema,
		navigation: navigationSchema,
		contentBlocks: z
			.array(
				z.discriminatedUnion('type', [
					z.object({ type: z.literal('section'), section: z.enum(CONTENT_SECTION_KEYS) }),
					z.object({
						type: z.literal('interlude'),
						image: AssetSchema,
						alt: z.string().optional(),
						height: z.enum(['screen', 'tall']).default('screen'),
						variant: z.enum(SHARED_SECTION_VARIANTS).optional(),
					}),
				]),
			)
			.optional(),
		sharing: sharingSchema,
	})
	.superRefine((value, ctx) => {
		const locationVariant = value.sectionStyles?.location?.variant;
		const themePreset = value.theme.preset;

		if (!locationVariant || !themePreset) return;

		const allowedPresets = LOCATION_VARIANT_PRESET_COMPATIBILITY[locationVariant];
		if (!allowedPresets || allowedPresets.includes(themePreset)) return;

		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['sectionStyles', 'location', 'variant'],
			message: `Location variant "${locationVariant}" is only supported with presets: ${allowedPresets.join(', ')}.`,
		});
	});
