import { z } from 'zod';
import { INVITATION_RENDER_SECTION_KEYS } from '@/lib/theme/theme-contract';
import { INVITATION_STATUSES } from '@/lib/intake/types';
import {
	focalPointSchema,
	overlayAnchorSchema,
	overlaySafeAreaSchema,
} from '@/lib/schemas/content/shared.schema';
import { LOCATION_PRESENTATIONS } from '@/lib/invitation/presentation-options';
import { LOCATION_MAP_STYLES } from '@/lib/invitation/location-presentation';
import {
	HERO_VARIANTS,
	LOCATION_VARIANTS,
	PERSONALIZED_ACCESS_VARIANTS,
	RSVP_VARIANTS,
	THANK_YOU_VARIANTS,
} from '@/lib/invitation/section-variants';
import {
	optionalText,
	optionalUrl,
	editableAssetSchema,
	venueEntrySchema,
	gallerySchema,
	itinerarySchema,
	draftIndicationSchema,
	giftsSchema,
	countdownEditorSchema,
	eventTimingEditorSchema,
	rsvpResponseMessagesSchema,
	envelopeSchema,
} from '@/lib/intake/schemas/shared-content.schema';
import { familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';
import { rsvpGuestCapSchema } from '@/lib/rsvp/guest-cap';

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
		hero: z.object({
			name: optionalText(200),
			secondaryName: optionalText(200),
			label: optionalText(200),
			nickname: optionalText(200),
			date: optionalText(40),
			backgroundImage: editableAssetSchema.optional(),
			backgroundImageDesktop: editableAssetSchema.optional(),
			backgroundImageMobile: editableAssetSchema.optional(),
			portrait: editableAssetSchema.optional(),
			presentation: z.object({ portraitEnabled: z.boolean().optional() }).strict().optional(),
			variant: z.enum(HERO_VARIANTS).optional(),
			focalPoint: focalPointSchema.optional(),
			focalPointMobile: focalPointSchema.optional(),
			focalPointTablet: focalPointSchema.optional(),
			focalPointDesktop: focalPointSchema.optional(),
		}),
	}),
	family: familyDraftSchema,
	location: z.object({
		visibility: z.enum(['public', 'after-rsvp']).optional(),
		presentation: z.enum(LOCATION_PRESENTATIONS).optional(),
		mapStyle: z.enum(LOCATION_MAP_STYLES).optional(),
		variant: z.enum(LOCATION_VARIANTS).optional(),
		presentationOptions: z
			.object({
				showFlourishes: z.boolean().optional(),
				showNavigationButtons: z.boolean().optional(),
				revealSurface: z.enum(['section', 'rsvp']).optional(),
			})
			.strict()
			.optional(),
		introEyebrow: optionalText(200),
		introHeading: optionalText(200),
		introLede: optionalText(1000),
		indicationsHeading: optionalText(200),
		eventTiming: eventTimingEditorSchema.optional(),
		venues: z.array(venueEntrySchema).optional(),
		indications: z.array(draftIndicationSchema).optional(),
	}),
	countdown: countdownEditorSchema,
	itinerary: itinerarySchema,
	rsvp: z
		.object({
			variant: z.enum(RSVP_VARIANTS).optional(),
			title: optionalText(200),
			guestCap: rsvpGuestCapSchema.optional(),
			confirmationMessage: optionalText(1000),
			confirmationMode: z.enum(['api', 'whatsapp', 'both']).optional(),
			whatsappPhone: optionalText(30),
			subcopy: optionalText(1000),
			confirmationDeadline: optionalText(60),
			responseMessages: rsvpResponseMessagesSchema,
			accessMode: z.enum(['personalized-only', 'hybrid']).optional(),
			personalizedAccess: z
				.object({
					variant: z.enum(PERSONALIZED_ACCESS_VARIANTS).optional(),
					title: optionalText(200),
					subtitle: optionalText(500),
					footerText: optionalText(500),
				})
				.strict()
				.optional(),
			calendar: z
				.object({
					title: optionalText(200),
					description: optionalText(1000),
					startsAt: optionalText(60),
				})
				.strict()
				.optional(),
		})
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
	music: z.object({
		url: optionalUrl,
		title: optionalText(200),
		autoPlay: z.boolean().optional(),
	}),
	envelope: envelopeSchema,
	gifts: giftsSchema,
	messages: z.object({
		quote: z.object({ text: optionalText(1000), author: optionalText(200) }).optional(),
		thankYou: z
			.object({
				variant: z.enum(THANK_YOU_VARIANTS).optional(),
				message: optionalText(2000),
				closingName: optionalText(200),
				closingPhrase: optionalText(200),
				date: optionalText(40),
				image: editableAssetSchema.optional(),
				focalPoint: focalPointSchema.optional(),
				overlayAnchor: overlayAnchorSchema.optional(),
				overlaySafeArea: overlaySafeAreaSchema.optional(),
			})
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
	sharing: z
		.object({
			invitation: optionalText(500),
			reminder: optionalText(500),
			ogDescription: optionalText(200),
			ogImage: editableAssetSchema.optional(),
		})
		.strict(),
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
			.nullable(),
		status: z.enum(INVITATION_STATUSES),
		clientName: z.string().trim().max(200),
		clientEmail: z.union([z.literal(''), z.email('Ingresa un correo válido.')]),
		clientWhatsapp: z.string().trim().max(30),
		photosReceived: z.boolean(),
	}),
});
