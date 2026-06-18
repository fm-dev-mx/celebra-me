import { z } from 'zod';
import {
	AssetSchema,
	ColorTokenSchema,
	focalPointSchema,
} from '@/lib/schemas/content/shared.schema';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';
import { THEME_PRESETS, INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';

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
		venueEvent: optionalText(200),
		isVisible: z.boolean().optional().default(true),
		sortOrder: z.number().int().min(0).optional(),
	})
	.strict();

export const gallerySchema = z
	.object({
		eyebrow: optionalText(200),
		title: optionalText(200),
		subtitle: optionalText(500),
		variant: z.union([z.enum(THEME_PRESETS), z.literal('single')]).optional(),
		presentation: z.enum(['pet-keepsake']).optional(),
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
		styleVariant: z.enum(INDICATION_STYLE_VARIANTS).optional(),
		text: z.string().trim().max(500),
	})
	.strict();

export const itinerarySchema = z
	.object({
		title: optionalText(200),
		subtitle: optionalText(500),
		items: z
			.array(
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
			)
			.optional(),
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
		cardLabel: z.string().trim().max(60).optional(),
		envelopeName: z.string().trim().max(200).optional(),
		cardName: z.string().trim().max(200).optional(),
		cardSecondaryName: z.string().trim().max(200).optional(),
		cardTagline: z.string().trim().max(120).optional(),
		guestLabel: z.string().trim().max(80).optional(),
		guestNameFallback: z.string().trim().max(200).optional(),
		sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).optional(),
		sealIcon: z.enum(['boot', 'heart', 'monogram', 'flower', 'special-edition']).optional(),
		sealInitials: z.string().trim().max(12).optional(),
		sealVariant: z.enum(['premium-rose']).optional(),
		microcopy: z.string().max(100).optional(),
		documentLabel: z.string().max(60).optional(),
		stampText: z.string().max(60).optional(),
		stampYear: z.string().max(10).optional(),
		tooltipText: z.string().max(100).optional(),
		closedPalette: z
			.object({
				primary: ColorTokenSchema.optional(),
				accent: ColorTokenSchema.optional(),
				background: ColorTokenSchema.optional(),
			})
			.optional(),
	})
	.strict();
