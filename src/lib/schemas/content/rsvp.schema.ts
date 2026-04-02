import { z } from 'zod';

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
		accessMode: z.enum(['personalized-only', 'hybrid']).default('personalized-only'),
		confirmationMessage: z
			.string()
			.default('¡Gracias por confirmar! Te esperamos con mucha emoción.'),
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
