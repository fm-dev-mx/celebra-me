import { z } from 'zod';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import { INVITATION_STATUSES } from '@/lib/intake/types';
import {
	optionalText,
	optionalUrl,
	editableAssetSchema,
	venueSchema,
	gallerySchema,
	itinerarySchema,
	draftIndicationSchema,
	giftsSchema,
	countdownEditorSchema,
	rsvpResponseMessagesSchema,
} from '@/lib/intake/schemas/shared-content.schema';
import { familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';

export const INVITATION_EDITOR_SECTION_KEYS = [
	'main',
	'family',
	'location',
	'countdown',
	'itinerary',
	'rsvp',
	'music',
	'gifts',
	'messages',
	'gallery',
	'photoNotes',
	'publication',
] as const;

export const InvitationEditorSectionKeySchema = z.enum(INVITATION_EDITOR_SECTION_KEYS);
export type InvitationEditorSectionKey = z.infer<typeof InvitationEditorSectionKeySchema>;

export const InvitationEditorSectionSchemas = {
	main: z.object({
		title: optionalText(200),
		description: optionalText(2000),
		hero: z.object({
			name: optionalText(200),
			secondaryName: optionalText(200),
			label: optionalText(200),
			nickname: optionalText(200),
			date: optionalText(40),
			backgroundImage: editableAssetSchema.optional(),
			backgroundImageMobile: editableAssetSchema.optional(),
			portrait: editableAssetSchema.optional(),
		}),
	}),
	family: familyDraftSchema,
	location: z.object({
		introEyebrow: optionalText(200),
		introHeading: optionalText(200),
		introLede: optionalText(1000),
		indicationsHeading: optionalText(200),
		ceremony: venueSchema.optional(),
		reception: venueSchema.optional(),
		indications: z.array(draftIndicationSchema).optional(),
	}),
	countdown: countdownEditorSchema,
	itinerary: itinerarySchema,
	rsvp: z
		.object({
			title: optionalText(200),
			guestCap: z.number().int().min(1).max(20).optional(),
			confirmationMessage: optionalText(1000),
			confirmationMode: z.enum(['api', 'whatsapp', 'both']).optional(),
			whatsappPhone: optionalText(30),
			subcopy: optionalText(1000),
			responseMessages: rsvpResponseMessagesSchema,
		})
		.superRefine((value, context) => {
			if (
				(value.confirmationMode === 'whatsapp' || value.confirmationMode === 'both') &&
				!value.whatsappPhone
			) {
				context.addIssue({
					code: 'custom',
					path: ['whatsappPhone'],
					message: 'El número de WhatsApp es obligatorio para este modo de confirmación.',
				});
			}
		}),
	music: z.object({
		url: optionalUrl,
		title: optionalText(200),
	}),
	gifts: giftsSchema,
	messages: z.object({
		quote: z.object({ text: optionalText(1000), author: optionalText(200) }).optional(),
		thankYou: z
			.object({ message: optionalText(2000), closingName: optionalText(200) })
			.optional(),
	}),
	gallery: gallerySchema,
	photoNotes: z.object({
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
	}),
	publication: z.object({
		sectionOrder: z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)),
	}),
} satisfies Record<InvitationEditorSectionKey, z.ZodType>;

export const SaveInvitationEditorSectionSchema = z.object({
	expectedUpdatedAt: z.string().min(1),
	value: z.unknown(),
});

export const UpdateInvitationEditorMetadataSchema = z.object({
	expectedUpdatedAt: z.string().min(1),
	value: z.object({
		title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
		slug: z
			.string()
			.trim()
			.max(120)
			.regex(
				/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
				'Usa solo letras minúsculas, números y guiones intermedios.',
			)
			.nullable(),
		status: z.enum(INVITATION_STATUSES),
		clientName: z.string().trim().max(200),
		clientEmail: z.union([z.literal(''), z.email('Ingresa un correo válido.')]),
		clientWhatsapp: z.string().trim().max(30),
		photosReceived: z.boolean(),
	}),
});
