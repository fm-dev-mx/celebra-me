import { z } from 'zod';
import {
	baseStoreGiftItemSchema,
	bankGiftItemSchema,
	paypalGiftItemSchema,
	cashGiftItemSchema,
	safeHttpUrlSchema,
} from '@/lib/schemas/content/gifts.schema';

const pendingFieldMarker = z.literal('__pending__').optional();

const optionalString = z.string().max(2000).trim().optional().default('');

const optionalUrl = z
	.string()
	.trim()
	.refine((value) => value === '' || safeHttpUrlSchema.safeParse(value).success, {
		message: 'Must be a valid URL or empty.',
	})
	.optional();

const coordinatesSchema = z
	.object({
		lat: z
			.string()
			.refine(
				(val) =>
					val === '' || (!isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90),
				{ message: 'La latitud debe ser un número entre -90 y 90.' },
			),
		lng: z
			.string()
			.refine(
				(val) =>
					val === '' ||
					(!isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180),
				{ message: 'La longitud debe ser un número entre -180 y 180.' },
			),
	})
	.optional();

const venueFieldsSchema = z.object({
	venueName: optionalString,
	address: optionalString,
	city: optionalString,
	date: optionalString,
	time: optionalString,
	mapUrl: optionalUrl,
	googleMapsUrl: optionalUrl,
	appleMapsUrl: optionalUrl,
	wazeUrl: optionalUrl,
	coordinates: coordinatesSchema,
});

export const dateLocationsBlockSchema = z.object({
	ceremony: venueFieldsSchema.optional(),
	reception: venueFieldsSchema.optional(),
	dressCode: optionalString,
	additionalIndications: optionalString,
	_pending: pendingFieldMarker,
});

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
