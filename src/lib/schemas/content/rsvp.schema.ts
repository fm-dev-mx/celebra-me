import { z } from 'astro:content';

export const rsvpSectionStyleSchema = z
	.object({
		variant: z.string().default('standard'),
		labels: z
			.object({
				name: z.string().optional(),
				guestCount: z.string().optional(),
				attendance: z.string().optional(),
				confirmButton: z.string().optional(),
			})
			.optional(),
	})
	.optional();

export const rsvpSchema = z
	.object({
		title: z.string().default('¿Vienes a celebrar conmigo?'),
		guestCap: z.number().int().positive().default(1),
		confirmationMessage: z
			.string()
			.default('¡Gracias por confirmar! Te esperamos con mucha emoción.'),
		showDietaryField: z.boolean().default(false),
		dietaryLabel: z.string().optional(),
		dietaryPlaceholder: z.string().optional(),
		guests: z
			.array(
				z.object({
					guestId: z.string().min(1),
					displayName: z.string().min(1),
					maxAllowedAttendees: z.number().int().positive().default(1),
				}),
			)
			.optional(),
		confirmationMode: z.enum(['api', 'whatsapp', 'both']).default('api'),
		whatsappConfig: z
			.object({
				phone: z.string(),
				confirmedTemplate: z.string().optional(),
				declinedTemplate: z.string().optional(),
				omitTitle: z.boolean().optional(),
			})
			.optional(),
	})
	.optional();
