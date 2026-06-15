import { z } from 'zod';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';

export const optionalText = (max = 2000) => z.string().trim().max(max).optional();
export const optionalUrl = z
	.string()
	.trim()
	.refine((value) => value === '' || z.url().safeParse(value).success, {
		message: 'Debe ser una URL válida o dejarse vacío.',
	})
	.optional();

export const uploadedRefSchema = z
	.object({
		type: z.literal('uploaded'),
		assetId: z.uuid(),
	})
	.strict();

/** Accept raw strings (UUIDs, URLs, keys) that `AssetSchema` normalizes into structured objects, matching the `AssetField` type. */
export const editableAssetSchema = z.union([AssetSchema, z.string(), uploadedRefSchema]);

export const venueSchema = z
	.object({
		venueName: optionalText(200),
		address: optionalText(500),
		city: optionalText(200),
		date: optionalText(40),
		time: optionalText(20),
		mapUrl: optionalUrl,
		image: editableAssetSchema.optional(),
		coordinates: z
			.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
			.optional(),
	})
	.strict();

export const venueEntrySchema = venueSchema
	.extend({
		id: z.string().min(1),
		type: z.enum(['ceremony', 'reception', 'custom']),
		label: optionalText(200),
		isVisible: z.boolean().optional().default(true),
		sortOrder: z.number().int().min(0).optional(),
	})
	.strict();

export const gallerySchema = z
	.object({
		eyebrow: optionalText(200),
		title: optionalText(200),
		subtitle: optionalText(500),
		items: z.array(
			z
				.object({
					image: editableAssetSchema,
					caption: optionalText(500),
					focalPoint: focalPointSchema.optional(),
					focalPointMobile: focalPointSchema.optional(),
					focalPointTablet: focalPointSchema.optional(),
					focalPointDesktop: focalPointSchema.optional(),
				})
				.strict(),
		),
	})
	.strict();

export const draftIndicationSchema = z
	.object({
		iconName: z.enum(ICON_NAMES_TUPLE),
		text: z.string().trim().max(500),
	})
	.strict();

export const itinerarySchema = z
	.object({
		title: optionalText(200),
		subtitle: optionalText(500),
		items: z.array(
			z
				.object({
					iconName: z.enum(ICON_NAMES_TUPLE),
					label: z
						.string()
						.trim()
						.min(1, 'El nombre de la actividad es obligatorio.')
						.max(200),
					description: optionalText(500),
					time: z.string().trim().min(1, 'La hora es obligatoria.').max(20),
				})
				.strict(),
		),
	})
	.strict();

export const giftsSchema = z
	.object({
		title: optionalText(200),
		subtitle: optionalText(500),
		items: z.array(giftItemSchema).optional(),
	})
	.strict();

export const countdownEditorSchema = z
	.object({
		title: optionalText(200),
		footerText: optionalText(500),
	})
	.strict();

export const eventTimingEditorSchema = z
	.object({
		localDateTime: optionalText(16).refine(
			(value) => !value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
			'Usa fecha y hora local del evento, por ejemplo 2026-08-01T20:00.',
		),
		timeZone: optionalText(80),
		startsAtUtc: optionalText(40),
	})
	.strict();

export const rsvpResponseMessageSchema = z
	.object({
		title: optionalText(500),
		subtitle: optionalText(500),
	})
	.strict()
	.optional();

export const rsvpResponseMessagesSchema = z
	.object({
		confirmed: rsvpResponseMessageSchema,
		declined: rsvpResponseMessageSchema,
	})
	.strict()
	.optional();

export const envelopeSchema = z
	.object({
		disabled: z.boolean().optional(),
		sealInitials: z.string().trim().max(12).optional(),
	})
	.strict();
