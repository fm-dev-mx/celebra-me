import {
	LOCATION_VARIANT_PRESET_COMPATIBILITY,
	type ThemePreset,
} from '@/lib/theme/theme-contract';
import { contentBlocksSchema } from '@/lib/schemas/content/content-block.schema';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { heroSchema } from '@/lib/schemas/content/hero.schema';
import { gallerySchema } from '@/lib/schemas/content/gallery.schema';
import { itinerarySchema } from '@/lib/schemas/content/itinerary.schema';
import { locationSchema } from '@/lib/schemas/content/location.schema';
import { familySchema } from '@/lib/schemas/content/family.schema';
import { rsvpSchema } from '@/lib/schemas/content/rsvp.schema';
import { giftsSchema } from '@/lib/schemas/content/gifts.schema';
import {
	baseEventFieldsSchema,
	countdownSchema,
	musicSchema,
	navigationSchema,
	quoteSchema,
	sharingSchema,
	thankYouSchema,
} from '@/lib/schemas/content/shared.schema';
import { sectionStylesSchema } from '@/lib/schemas/content/section-styles.schema';

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
		gallery: gallerySchema,
		envelope: envelopeSchema,
		itinerary: itinerarySchema,
		gifts: giftsSchema,
		countdown: countdownSchema,
		navigation: navigationSchema,
		contentBlocks: contentBlocksSchema,
		sharing: sharingSchema,
	})
	.superRefine((value, ctx) => {
		// Cross-field rule: editorial location styling depends on compatible preset token delivery.
		const locationVariant = value.sectionStyles?.location?.variant;
		const themePreset = value.theme.preset;

		if (!locationVariant || !themePreset) return;

		const allowedPresets = (
			LOCATION_VARIANT_PRESET_COMPATIBILITY as Record<string, readonly ThemePreset[]>
		)[locationVariant];
		if (!allowedPresets || allowedPresets.includes(themePreset)) return;

		ctx.addIssue({
			code: 'custom',
			path: ['sectionStyles', 'location', 'variant'],
			message: `Location variant "${locationVariant}" is only supported with presets: ${allowedPresets.join(', ')}.`,
		});
	});
