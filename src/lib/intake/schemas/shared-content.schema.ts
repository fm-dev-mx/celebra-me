import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { ITINERARY_ICON_KEYS } from '@/lib/theme/theme-contract';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';

export const optionalText = (max = 2000) => z.string().trim().max(max).optional();
export const optionalUrl = z
	.string()
	.trim()
	.refine((value) => value === '' || z.url().safeParse(value).success, {
		message: 'Debe ser una URL válida o dejarse vacío.',
	})
	.optional();

export const editableAssetSchema = z
	.union([z.string(), AssetSchema])
	.refine(
		(value) => AssetSchema.safeParse(value).success,
		'La referencia de imagen no es válida.',
	);

export const venueSchema = z.object({
	venueName: optionalText(200),
	address: optionalText(500),
	city: optionalText(200),
	date: optionalText(40),
	time: optionalText(20),
	mapUrl: optionalUrl,
});

export const gallerySchema = z.object({
	title: optionalText(200),
	subtitle: optionalText(500),
	items: z.array(
		z.object({
			image: editableAssetSchema,
			caption: optionalText(500),
			focalPoint: focalPointSchema.optional(),
		}),
	),
});

export const itinerarySchema = z.object({
	title: optionalText(200),
	subtitle: optionalText(500),
	items: z.array(
		z.object({
			icon: z.enum(ITINERARY_ICON_KEYS),
			label: z.string().trim().min(1, 'El nombre de la actividad es obligatorio.').max(200),
			description: optionalText(500),
			time: z.string().trim().min(1, 'La hora es obligatoria.').max(20),
		}),
	),
});

export const giftsSchema = z.object({
	title: optionalText(200),
	subtitle: optionalText(500),
	items: z.array(giftItemSchema).optional(),
});
