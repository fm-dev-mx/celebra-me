import { z } from 'zod';
import { rsvpResponseMessagesSchema } from '@/lib/intake/schemas/shared-content.schema';
import { rsvpGuestCapSchema } from '@/lib/rsvp/guest-cap';
import {
	PERSONALIZED_ACCESS_VARIANTS,
	RSVP_VARIANTS,
} from '@/lib/invitation/section-variants';

export const rsvpLabelsSchema = z
	.object({
		name: z.string().optional(),
		guestCount: z.string().optional(),
		attendance: z.string().optional(),
		confirmButton: z.string().optional(),
		phone: z.string().optional(),
		notesLabel: z.string().optional(),
		notesPlaceholder: z.string().optional(),
	})
	.strict();

export const rsvpSchema = z
	.object({
		variant: z.enum(RSVP_VARIANTS),
		subcopy: z.string().optional(),
		title: z.string().default('¿Vienes a celebrar conmigo?'),
		guestCap: rsvpGuestCapSchema.default(1),
		accessMode: z.enum(['personalized-only', 'hybrid']).default('personalized-only'),
		confirmationMessage: z
			.string()
			.default('¡Gracias por confirmar! Te esperamos con mucha emoción.'),
		confirmationMode: z.enum(['api', 'whatsapp', 'both']).default('api'),
		responseMessages: rsvpResponseMessagesSchema,
		whatsappConfig: z
			.object({
				phone: z.string(),
				confirmedTemplate: z.string().optional(),
				declinedTemplate: z.string().optional(),
				omitTitle: z.boolean().optional(),
			})
			.strict()
			.optional(),
		personalizedAccess: z
			.object({
				variant: z.enum(PERSONALIZED_ACCESS_VARIANTS),
				title: z.string().optional(),
				subtitle: z.string().optional(),
				footerText: z.string().optional(),
				noteText: z.string().optional(),
			})
			.strict(),
		labels: rsvpLabelsSchema.optional(),
		calendar: z
			.object({
				title: z.string().optional(),
				description: z.string().optional(),
				startsAt: z.string().optional(),
			})
			.strict()
			.optional(),
	})
	.strict()
	.optional();
