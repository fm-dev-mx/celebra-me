import { z } from 'zod';
import {
	baseStoreGiftItemSchema,
	bankGiftItemSchema,
	paypalGiftItemSchema,
	cashGiftItemSchema,
} from '@/lib/schemas/content/gifts.schema';

export const giftItemSchema = z.discriminatedUnion('type', [
	baseStoreGiftItemSchema.extend({
		title: z.string().min(1).max(200),
		description: z.string().max(500).optional(),
	}),
	bankGiftItemSchema.extend({
		title: z.string().min(1).max(200).default('Transferencia'),
		bankName: z.string().min(1).max(200),
		accountHolder: z.string().min(1).max(200),
		clabe: z.string().min(1).max(30),
		accountNumber: z.string().max(30).optional(),
	}),
	paypalGiftItemSchema.extend({
		title: z.string().min(1).max(200).default('PayPal'),
	}),
	cashGiftItemSchema.extend({
		title: z.string().min(1).max(200).default('Lluvia de Sobres'),
		text: z.string().max(500).optional(),
	}),
]);
