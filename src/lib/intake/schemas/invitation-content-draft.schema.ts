import { z } from 'zod';
import { invitationDataAnswersSchema } from '@/lib/invitation-data/answers-schema';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import { interludesSchema } from '@/lib/schemas/content/interludes.schema';
import {
	optionalText,
	gallerySchema,
	itinerarySchema,
	giftsSchema,
	countdownEditorSchema,
	eventTimingEditorSchema,
	envelopeSchema,
} from '@/lib/intake/schemas/shared-content.schema';
import {
	heroDraftSchema,
	locationDraftSchema,
	musicDraftSchema,
	photoNotesDraftSchema,
	quoteDraftSchema,
	rsvpDraftSchema,
	sharingDraftSchema,
	thankYouDraftSchema,
} from '@/lib/intake/schemas/draft-sections.schema';
import { familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';

export const DraftActionSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('publish') }),
	z.object({ action: z.literal('revise') }),
]);

export const InvitationContentDraftContentSchema = z
	.object({
		orderSource: z
			.object({
				orderId: z.uuid(),
				packageName: z.string().nullable(),
				answers: invitationDataAnswersSchema,
			})
			.optional(),
		title: optionalText(200),
		description: optionalText(2000),
		eventType: optionalText(50),
		sectionOrder: z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)).optional(),
		hero: heroDraftSchema.optional(),
		quote: quoteDraftSchema.optional(),
		thankYou: thankYouDraftSchema.optional(),
		music: musicDraftSchema.optional(),
		location: locationDraftSchema.optional(),
		countdown: countdownEditorSchema.optional(),
		eventTiming: eventTimingEditorSchema.optional(),
		itinerary: itinerarySchema.optional(),
		gallery: gallerySchema.optional(),
		family: familyDraftSchema.optional(),
		gifts: giftsSchema.optional(),
		interludes: interludesSchema,
		rsvp: rsvpDraftSchema.optional(),
		envelope: envelopeSchema.optional(),
		photoNotes: photoNotesDraftSchema.optional(),
		sharing: sharingDraftSchema.optional(),
	})
	.catchall(z.unknown());

export const UpdateDraftContentSchema = z.object({
	expectedUpdatedAt: z.string().min(1),
	content: InvitationContentDraftContentSchema,
});

export type DraftContent = z.infer<typeof InvitationContentDraftContentSchema>;
