import { z } from 'zod';
import { GIFTS_PRESENTATIONS } from '@/lib/invitation/presentation-options';
import { GIFTS_VARIANTS } from '@/lib/invitation/section-variants';

export const safeHttpUrlSchema = z.url().refine(
	(value) => {
		const protocol = new URL(value).protocol;
		return protocol === 'http:' || protocol === 'https:';
	},
	{ message: 'Gift links must use http or https.' },
);

// Canonical gift item schemas — used as the single source of truth for the
// gift data shape. The discriminated union type GiftItem is derived from
// giftItemSchema. Intake schemas import and extend these with stricter
// validation constraints.

const storeGiftLinkSchema = z.object({
	label: z.string().min(1),
	url: safeHttpUrlSchema,
});

export const baseStoreGiftItemSchema = z.object({
	type: z.literal('store'),
	title: z.string(),
	url: safeHttpUrlSchema.optional(),
	links: z.array(storeGiftLinkSchema).optional(),
	logo: z.string().optional(),
	description: z.string().optional(),
	tableNumber: z.string().optional(),
});

export const storeGiftItemSchema = baseStoreGiftItemSchema.superRefine((value, ctx) => {
	const hasLegacyUrl = typeof value.url === 'string' && value.url.length > 0;
	const hasLinks = Array.isArray(value.links) && value.links.length > 0;

	if (!hasLegacyUrl && !hasLinks) {
		ctx.addIssue({
			code: 'custom',
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
	url: safeHttpUrlSchema,
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
		variant: z.enum(GIFTS_VARIANTS),
		title: z.string().optional(),
		subtitle: z.string().optional(),
		presentation: z.enum(GIFTS_PRESENTATIONS).optional(),
		items: z.array(giftItemSchema).optional(),
	})
	.strict()
	.superRefine((gifts, ctx) => {
		const presentation = gifts.presentation ?? 'catalog';
		const items = gifts.items ?? [];
		if (presentation === 'legend-only' && items.length > 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['items'],
				message: 'legend-only gifts must not include catalog items.',
			});
		}
	})
	.optional();
