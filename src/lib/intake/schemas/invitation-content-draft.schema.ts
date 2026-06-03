import { z } from 'zod';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import {
	optionalText,
	optionalUrl,
	editableAssetSchema,
	venueSchema,
	gallerySchema,
	itinerarySchema,
	giftsSchema,
} from '@/lib/intake/schemas/shared-content.schema';

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
			})
			.optional(),
		music: z
			.object({
				url: optionalUrl,
				title: optionalText(200),
			})
			.optional(),
		location: z
			.object({
				ceremony: venueSchema.optional(),
				reception: venueSchema.optional(),
				dressCode: optionalText(500),
				additionalIndications: optionalText(),
			})
			.optional(),
		itinerary: itinerarySchema.optional(),
		gallery: gallerySchema.optional(),
		family: z
			.object({
				fatherName: optionalText(200),
				fatherDeceased: z.boolean().optional(),
				motherName: optionalText(200),
				motherDeceased: z.boolean().optional(),
				spouseName: optionalText(200),
				godparents: optionalText(),
				children: optionalText(),
				sectionMessage: optionalText(),
				featuredImage: editableAssetSchema.optional(),
			})
			.optional(),
		gifts: giftsSchema.optional(),
		rsvp: z
			.object({
				title: optionalText(200),
				guestCap: z.number().int().min(1).max(20).optional(),
				confirmationMessage: optionalText(1000),
				confirmationMode: optionalText(20),
				whatsappPhone: optionalText(30),
				subcopy: optionalText(1000),
			})
			.optional(),
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
	})
	.catchall(z.unknown());

export const UpdateDraftContentSchema = z.object({
	content: InvitationContentDraftContentSchema,
});

export type DraftContent = z.infer<typeof InvitationContentDraftContentSchema>;
export type GenerateDraftActionInput = z.infer<typeof DraftActionSchema>;
export type UpdateDraftContentInput = z.infer<typeof UpdateDraftContentSchema>;
