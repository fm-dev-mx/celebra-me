import { z } from 'zod';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';

export const DraftActionSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('generate') }),
	z.object({ action: z.literal('publish') }),
]);

export const InvitationContentDraftContentSchema = z
	.object({
		title: z.string().optional(),
		description: z.string().optional(),
		eventType: z.string().optional(),
		hero: z
			.object({
				name: z.string().optional(),
				secondaryName: z.string().optional(),
				label: z.string().optional(),
				nickname: z.string().optional(),
				date: z.string().optional(),
			})
			.optional(),
		quote: z
			.object({
				text: z.string().optional(),
				author: z.string().optional(),
			})
			.optional(),
		thankYou: z
			.object({
				message: z.string().optional(),
				closingName: z.string().optional(),
			})
			.optional(),
		music: z
			.object({
				url: z.string().optional(),
				title: z.string().optional(),
			})
			.optional(),
		location: z
			.object({
				ceremony: z
					.object({
						venueName: z.string().optional(),
						address: z.string().optional(),
						city: z.string().optional(),
						date: z.string().optional(),
						time: z.string().optional(),
						mapUrl: z.string().optional(),
					})
					.optional(),
				reception: z
					.object({
						venueName: z.string().optional(),
						address: z.string().optional(),
						city: z.string().optional(),
						date: z.string().optional(),
						time: z.string().optional(),
						mapUrl: z.string().optional(),
					})
					.optional(),
				dressCode: z.string().optional(),
				additionalIndications: z.string().optional(),
			})
			.optional(),
		family: z
			.object({
				fatherName: z.string().optional(),
				fatherDeceased: z.boolean().optional(),
				motherName: z.string().optional(),
				motherDeceased: z.boolean().optional(),
				spouseName: z.string().optional(),
				godparents: z.string().optional(),
				children: z.string().optional(),
				sectionMessage: z.string().optional(),
			})
			.optional(),
		gifts: z
			.object({
				title: z.string().optional(),
				subtitle: z.string().optional(),
				items: z.array(giftItemSchema).optional(),
			})
			.optional(),
		rsvp: z
			.object({
				title: z.string().optional(),
				guestCap: z.number().optional(),
				confirmationMessage: z.string().optional(),
				confirmationMode: z.string().optional(),
				whatsappPhone: z.string().optional(),
				subcopy: z.string().optional(),
			})
			.optional(),
		photoNotes: z
			.object({
				whatsappSent: z.boolean().optional(),
				heroPhoto: z.string().optional(),
				portraitPhoto: z.string().optional(),
				galleryPhotos: z.string().optional(),
				familyPhoto: z.string().optional(),
				specialPhoto: z.string().optional(),
				generalNotes: z.string().optional(),
				photoOrder: z.string().optional(),
				cropNotes: z.string().optional(),
				priorityNotes: z.string().optional(),
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
