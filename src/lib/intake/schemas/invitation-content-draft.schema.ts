import { z } from 'zod';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import {
	focalPointSchema,
	overlayAnchorSchema,
	overlaySafeAreaSchema,
} from '@/lib/schemas/content/shared.schema';
import { interludesSchema } from '@/lib/schemas/content/interludes.schema';
import {
	optionalText,
	optionalUrl,
	editableAssetSchema,
	venueSchema,
	venueEntrySchema,
	gallerySchema,
	itinerarySchema,
	giftsSchema,
	countdownEditorSchema,
	eventTimingEditorSchema,
	draftIndicationSchema,
	rsvpResponseMessagesSchema,
	envelopeSchema,
} from '@/lib/intake/schemas/shared-content.schema';
import { familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';

export const DraftActionSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('generate') }),
	z.object({ action: z.literal('publish') }),
	z.object({ action: z.literal('revise') }),
]);

export const InvitationContentDraftContentSchema = z
	.object({
		title: optionalText(200),
		description: optionalText(2000),
		eventType: optionalText(50),
		sectionOrder: z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)).optional(),
		hero: z
			.object({
				name: optionalText(200),
				secondaryName: optionalText(200),
				label: optionalText(200),
				nickname: optionalText(200),
				date: optionalText(40),
				backgroundImage: editableAssetSchema.optional(),
				backgroundImageMobile: editableAssetSchema.optional(),
				portrait: editableAssetSchema.optional(),
			})
			.optional(),
		quote: z
			.object({
				text: optionalText(1000),
				author: optionalText(200),
			})
			.optional(),
		thankYou: z
			.object({
				message: optionalText(2000),
				closingName: optionalText(200),
				image: editableAssetSchema.optional(),
				focalPoint: focalPointSchema.optional(),
				overlayAnchor: overlayAnchorSchema.optional(),
				overlaySafeArea: overlaySafeAreaSchema.optional(),
			})
			.optional(),
		music: z
			.object({
				url: optionalUrl,
				title: optionalText(200),
				autoPlay: z.boolean().optional(),
			})
			.optional(),
		location: z
			.object({
				visibility: z.enum(['public', 'after-rsvp']).optional(),
				introEyebrow: optionalText(200),
				introHeading: optionalText(200),
				introLede: optionalText(1000),
				indicationsHeading: optionalText(200),
				ceremony: venueSchema.optional(),
				reception: venueSchema.optional(),
				venues: z.array(venueEntrySchema).optional(),
				indications: z.array(draftIndicationSchema).optional(),
			})
			.optional(),
		countdown: countdownEditorSchema.optional(),
		eventTiming: eventTimingEditorSchema.optional(),
		itinerary: itinerarySchema.optional(),
		gallery: gallerySchema.optional(),
		family: familyDraftSchema.optional(),
		gifts: giftsSchema.optional(),
		interludes: interludesSchema,
		rsvp: z
			.object({
				title: optionalText(200),
				guestCap: z.number().int().min(1).max(20).optional(),
				confirmationMessage: optionalText(1000),
				confirmationMode: optionalText(20),
				whatsappPhone: optionalText(30),
				subcopy: optionalText(1000),
				confirmationDeadline: optionalText(60),
				responseMessages: rsvpResponseMessagesSchema,
			})
			.optional(),
		envelope: envelopeSchema.optional(),
		photoNotes: z
			.object({
				whatsappSent: z.boolean().optional(),
				heroPhoto: optionalText(),
				portraitPhoto: optionalText(),
				galleryPhotos: optionalText(),
				familyPhoto: optionalText(),
				specialPhoto: optionalText(),
				generalNotes: optionalText(),
				photoOrder: optionalText(),
				cropNotes: optionalText(),
				priorityNotes: optionalText(),
			})
			.optional(),
		sharing: z
			.object({
				invitation: optionalText(500),
				reminder: optionalText(500),
				ogDescription: optionalText(200),
			})
			.optional(),
	})
	.catchall(z.unknown());

export const UpdateDraftContentSchema = z.object({
	content: InvitationContentDraftContentSchema,
});

export type DraftContent = z.infer<typeof InvitationContentDraftContentSchema>;
export type GenerateDraftActionInput = z.infer<typeof DraftActionSchema>;
export type UpdateDraftContentInput = z.infer<typeof UpdateDraftContentSchema>;
