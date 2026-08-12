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
import { sectionStylesSchema } from '@/lib/schemas/content/section-styles.schema';
import {
	normalizeInvitationVariantInput,
	VariantNormalizationConflictError,
} from '@/lib/invitation/variant-normalization';

export const canonicalEventContentSchema = baseEventFieldsSchema.extend({
	sectionStyles: sectionStylesSchema,
	hero: heroSchema,
	location: locationSchema.optional(),
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

type CanonicalEventContent = z.infer<typeof canonicalEventContentSchema>;

/**
 * Normalize legacy variant inputs, then validate the canonical contract.
 * Dual-input conflicts become typed custom issues; unknown variants fail closed.
 */
export const eventContentSchema: z.ZodType<CanonicalEventContent> = z
	.any()
	.transform((input, context) => {
		try {
			const normalized = normalizeInvitationVariantInput(input);
			const parsed = canonicalEventContentSchema.safeParse(normalized);
			if (!parsed.success) {
				for (const issue of parsed.error.issues) {
					context.addIssue({
						...issue,
						path: issue.path,
					});
				}
				return z.NEVER;
			}
			return parsed.data;
		} catch (error) {
			if (error instanceof VariantNormalizationConflictError) {
				for (const conflict of error.conflicts) {
					context.addIssue({
						code: 'custom',
						path: conflict.path,
						message: conflict.message,
					});
				}
				return z.NEVER;
			}
			throw error;
		}
	});
