import { z } from 'zod';
import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import { heroSchema } from '@/lib/schemas/content/hero.schema';
import { gallerySchema } from '@/lib/schemas/content/gallery.schema';
import { itinerarySchema } from '@/lib/schemas/content/itinerary.schema';
import { locationSchema } from '@/lib/schemas/content/location.schema';
import { familySchema } from '@/lib/schemas/content/family.schema';
import { rsvpSchema } from '@/lib/schemas/content/rsvp.schema';
import { giftsSchema } from '@/lib/schemas/content/gifts.schema';
import { interludesSchema } from '@/lib/schemas/content/interludes.schema';
import {
	baseEventFieldsSchema,
	countdownSchema,
	musicSchema,
	navigationSchema,
	quoteSchema,
	sharingSchema,
	thankYouSchema,
} from '@/lib/schemas/content/shared.schema';
export const canonicalEventContentSchema = baseEventFieldsSchema
	.extend({
		hero: heroSchema,
		location: locationSchema.optional(),
		family: familySchema,
		rsvp: rsvpSchema,
		// Optional: sectionOrder may omit quote; do not require invented copy.
		quote: quoteSchema.optional(),
		thankYou: thankYouSchema,
		music: musicSchema,
		gallery: gallerySchema,
		envelope: envelopeSchema,
		itinerary: itinerarySchema,
		gifts: giftsSchema,
		countdown: countdownSchema,
		navigation: navigationSchema,
		interludes: interludesSchema,
		sharing: sharingSchema,
	})
	.strict()
	.superRefine((content, context) => {
		if (content.sectionOrder.includes('countdown') && !content.countdown?.variant) {
			context.addIssue({
				code: 'custom',
				path: ['countdown', 'variant'],
				message: 'sectionOrder includes countdown, so countdown.variant is required',
			});
		}
	});

export type CanonicalEventContent = z.infer<typeof canonicalEventContentSchema>;
export type CanonicalEventContentInput = z.input<typeof canonicalEventContentSchema>;

/** Canonical content is parsed exactly once; legacy aliases are rejected. */
export const eventContentSchema: z.ZodType<CanonicalEventContent> = canonicalEventContentSchema;
