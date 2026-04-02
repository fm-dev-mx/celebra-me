import { z } from 'zod';

export const giftsSchema = z
	.object({
		title: z.string().optional(),
		subtitle: z.string().optional(),
		items: z.array(
			z.discriminatedUnion('type', [
				z.object({
					type: z.literal('store'),
					title: z.string(),
					url: z.url(),
					logo: z.string().optional(),
				}),
				z.object({
					type: z.literal('bank'),
					title: z.string().default('Transferencia'),
					bankName: z.string(),
					accountHolder: z.string(),
					clabe: z.string(),
					accountNumber: z.string().optional(),
				}),
				z.object({
					type: z.literal('paypal'),
					title: z.string().default('PayPal'),
					url: z.url(),
				}),
				z.object({
					type: z.literal('cash'),
					title: z.string().default('Lluvia de Sobres'),
					text: z.string().optional(),
				}),
			]),
		),
	})
	.optional();
