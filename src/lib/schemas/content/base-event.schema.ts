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
import { sectionStylesSchema } from '@/lib/schemas/content/section-styles.schema';

export const eventContentSchema = baseEventFieldsSchema.extend({
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
	interludes: interludesSchema,
	sharing: sharingSchema,
});
