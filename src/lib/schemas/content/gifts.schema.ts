import { z } from 'zod';

// Canonical gift item schemas — used as the single source of truth for the
// gift data shape. The discriminated union type GiftItem is derived from
// giftItemSchema. Intake schemas import and extend these with stricter
// validation constraints.

const storeGiftLinkSchema = z.object({
	label: z.string().min(1),
	url: z.url(),
});

export const storeGiftItemSchema = z
	.object({
		type: z.literal('store'),
		title: z.string(),
		url: z.url().optional(),
		links: z.array(storeGiftLinkSchema).optional(),
		logo: z.string().optional(),
		description: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		const hasLegacyUrl = typeof value.url === 'string' && value.url.length > 0;
		const hasLinks = Array.isArray(value.links) && value.links.length > 0;

		if (!hasLegacyUrl && !hasLinks) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'A store gift item must include either url or links.',
				path: [],
			});
		}
	});

export const bankGiftItemSchema = z.object({
	type: z.literal('bank'),
	title: z.string().default('Transferencia'),
	bankName: z.string(),
	accountHolder: z.string(),
	clabe: z.string(),
	accountNumber: z.string().optional(),
});

export const paypalGiftItemSchema = z.object({
	type: z.literal('paypal'),
	title: z.string().default('PayPal'),
	url: z.url(),
});

export const cashGiftItemSchema = z.object({
	type: z.literal('cash'),
	title: z.string().default('Lluvia de Sobres'),
	text: z.string().optional(),
});

export const giftItemSchema = z.discriminatedUnion('type', [
	storeGiftItemSchema,
	bankGiftItemSchema,
	paypalGiftItemSchema,
	cashGiftItemSchema,
]);

export const giftsSchema = z
	.object({
		title: z.string().optional(),
		subtitle: z.string().optional(),
		items: z.array(giftItemSchema),
	})
	.optional();
