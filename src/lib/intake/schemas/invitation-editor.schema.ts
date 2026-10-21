import { z } from 'zod';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import { INVITATION_STATUSES } from '@/lib/intake/types';
import { isReservedInvitationSlug, RESERVED_SLUG_MESSAGE } from '@/lib/invitation/slug-policy';
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

export const INVITATION_EDITOR_SECTION_KEYS = [
	'main',
	'family',
	'location',
	'countdown',
	'itinerary',
	'rsvp',
	'music',
	'envelope',
	'gifts',
	'messages',
	'gallery',
	'photoNotes',
	'publication',
	'sharing',
] as const;

export const InvitationEditorSectionKeySchema = z.enum(INVITATION_EDITOR_SECTION_KEYS);
export type InvitationEditorSectionKey = z.infer<typeof InvitationEditorSectionKeySchema>;

export const InvitationEditorSectionSchemas = {
	main: z.object({
		title: optionalText(200),
		description: optionalText(2000),
		hero: heroDraftSchema,
	}),
	family: familyDraftSchema,
	location: locationDraftSchema.extend({ eventTiming: eventTimingEditorSchema.optional() }),
	countdown: countdownEditorSchema,
	itinerary: itinerarySchema,
	rsvp: rsvpDraftSchema
		.extend({ confirmationMode: z.enum(['api', 'whatsapp', 'both']).optional() })
		.strict()
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
	music: musicDraftSchema,
	envelope: envelopeSchema,
	gifts: giftsSchema,
	messages: z.object({
		quote: quoteDraftSchema.optional(),
		thankYou: thankYouDraftSchema.optional(),
	}),
	gallery: gallerySchema,
	photoNotes: photoNotesDraftSchema,
	publication: z.object({
		sectionOrder: z.array(z.enum(INVITATION_RENDER_SECTION_KEYS)),
	}),
	sharing: sharingDraftSchema.strict(),
} satisfies Record<InvitationEditorSectionKey, z.ZodType>;

export const SaveInvitationEditorSectionSchema = z.object({
	expectedUpdatedAt: z.string().min(1),
	value: z.unknown(),
});

export const UpdateInvitationEditorMetadataSchema = z.object({
	operationId: z.uuid(),
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
			.refine((slug) => !isReservedInvitationSlug(slug), RESERVED_SLUG_MESSAGE)
			.nullable(),
		status: z.enum(INVITATION_STATUSES),
		clientName: z.string().trim().max(200),
		clientEmail: z.union([z.literal(''), z.email('Ingresa un correo válido.')]),
		clientWhatsapp: z.string().trim().max(30),
		photosReceived: z.boolean(),
	}),
});
