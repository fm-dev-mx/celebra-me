import { z } from 'zod';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { rsvpResponseMessagesSchema } from '@/lib/intake/schemas/shared-content.schema';
import { rsvpGuestCapSchema } from '@/lib/rsvp/guest-cap';

export const rsvpSectionStyleSchema = z
	.object({
		variant: z.enum(THEME_PRESETS).optional(),
		labels: z
			.object({
				name: z.string().optional(),
				guestCount: z.string().optional(),
				attendance: z.string().optional(),
				confirmButton: z.string().optional(),
				phone: z.string().optional(),
				notesLabel: z.string().optional(),
				notesPlaceholder: z.string().optional(),
			})
			.strict()
			.optional(),
	})
	.strict()
	.optional();

export const rsvpSchema = z
	.object({
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
				title: z.string().optional(),
				subtitle: z.string().optional(),
				footerText: z.string().optional(),
			})
			.strict()
			.optional(),
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
