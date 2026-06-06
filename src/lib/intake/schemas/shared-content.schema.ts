import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { iconNamesTuple } from '@/lib/icons/icon-catalog';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';

const ICON_NAMES_TUPLE = iconNamesTuple();

export const optionalText = (max = 2000) => z.string().trim().max(max).optional();
export const optionalUrl = z
	.string()
	.trim()
	.refine((value) => value === '' || z.url().safeParse(value).success, {
		message: 'Debe ser una URL válida o dejarse vacío.',
	})
	.optional();

export const uploadedRefSchema = z.object({
	type: z.literal('uploaded'),
	assetId: z.string().uuid(),
});

export const editableAssetSchema = z.union([AssetSchema, z.string(), uploadedRefSchema]);

export const venueSchema = z.object({
	venueName: optionalText(200),
	address: optionalText(500),
	city: optionalText(200),
	date: optionalText(40),
	time: optionalText(20),
	mapUrl: optionalUrl,
	image: editableAssetSchema.optional(),
});

export const gallerySchema = z.object({
	title: optionalText(200),
	subtitle: optionalText(500),
	items: z.array(
		z.object({
			image: editableAssetSchema,
			caption: optionalText(500),
			focalPoint: focalPointSchema.optional(),
			focalPointMobile: focalPointSchema.optional(),
			focalPointTablet: focalPointSchema.optional(),
			focalPointDesktop: focalPointSchema.optional(),
		}),
	),
});

export const draftIndicationSchema = z.object({
	iconName: z.enum(ICON_NAMES_TUPLE),
	text: z.string().trim().max(500),
});

export const itinerarySchema = z.object({
	title: optionalText(200),
	subtitle: optionalText(500),
	items: z.array(
		z.object({
			iconName: z.enum(ICON_NAMES_TUPLE),
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

export const countdownEditorSchema = z.object({
	title: optionalText(200),
	footerText: optionalText(500),
});
