import { z } from 'zod';
import {
	AssetSchema,
	ColorTokenSchema,
	focalPointSchema,
} from '@/lib/schemas/content/shared.schema';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { giftItemSchema } from '@/lib/intake/schemas/intake-block.schema';
import { THEME_PRESETS, INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';
import { ENVELOPE_SEAL_COLORS } from '@/lib/invitation/reveal-card';
import {
	COUNTDOWN_UNITS,
	GALLERY_LAYOUT_ROLES,
	GALLERY_MOBILE_BROWSE_MODES,
	GALLERY_PRESENTATIONS,
	GIFTS_PRESENTATIONS,
	assertSupportedGalleryPresentation,
} from '@/lib/invitation/presentation-options';
import {
	GALLERY_VARIANTS,
	GIFTS_VARIANTS,
	ITINERARY_VARIANTS,
	COUNTDOWN_VARIANTS,
} from '@/lib/invitation/section-variants';

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
		googleMapsUrl: optionalUrl,
		appleMapsUrl: optionalUrl,
		wazeUrl: optionalUrl,
		image: editableAssetSchema.optional(),
		focalPoint: focalPointSchema.optional(),
		coordinates: z
			.object({
				lat: z.number().min(-90).max(90),
				lng: z.number().min(-180).max(180),
				zoom: z.number().min(1).max(22).optional(),
			})
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
		variant: z.enum(GALLERY_VARIANTS).optional(),
		presentation: z.enum(GALLERY_PRESENTATIONS).optional(),
		variantOptions: z
			.object({
				mobileBrowse: z.enum(GALLERY_MOBILE_BROWSE_MODES).optional(),
			})
			.strict()
			.optional(),
		items: z.array(
			z
				.object({
					key: optionalText(120),
					layoutRole: z.enum(GALLERY_LAYOUT_ROLES).optional(),
					aspectRatio: optionalText(32),
					image: editableAssetSchema,
					alt: optionalText(500),
					caption: optionalText(500),
					focalPoint: focalPointSchema.optional(),
					focalPointMobile: focalPointSchema.optional(),
					focalPointTablet: focalPointSchema.optional(),
					focalPointDesktop: focalPointSchema.optional(),
				})
				.strict(),
		),
	})
	.strict()
	.superRefine((gallery, context) => {
		try {
			assertSupportedGalleryPresentation(gallery.presentation, gallery.items);
		} catch (error) {
			context.addIssue({
				code: 'custom',
				path: ['presentation'],
				message:
					error instanceof Error
						? error.message
						: 'Presentación de galería no compatible.',
			});
		}

		if (gallery.variant === 'single-keepsake' && gallery.items.length !== 1) {
			context.addIssue({
				code: 'custom',
				path: ['items'],
				message:
					'La variante single-keepsake requiere exactamente un elemento en la galería.',
			});
		}

		if (gallery.variant === 'feature-stack' && gallery.items.length < 3) {
			context.addIssue({
				code: 'custom',
				path: ['items'],
				message:
					'La variante feature-stack requiere al menos tres elementos en la galería.',
			});
		}

		if (gallery.variant === 'paired-feature-band') {
			const hasFeatureRole = gallery.items.some((item) => item.layoutRole === 'feature');
			if (!hasFeatureRole) {
				context.addIssue({
					code: 'custom',
					path: ['items'],
					message:
						'La variante paired-feature-band requiere al menos un elemento con rol feature.',
				});
			}
			if (gallery.items.length < 3) {
				context.addIssue({
					code: 'custom',
					path: ['items'],
					message:
						'La variante paired-feature-band requiere al menos tres elementos en la galería.',
				});
			}
		}
	});

export const draftIndicationSchema = z
	.object({
		iconName: z.enum(ICON_NAMES_TUPLE),
		styleVariant: z.enum(INDICATION_STYLE_VARIANTS).optional(),
		title: optionalText(120),
		text: z.string().trim().max(500),
	})
	.strict();

export const itinerarySchema = z
	.object({
		title: optionalText(200),
		subtitle: optionalText(500),
		variant: z.enum(ITINERARY_VARIANTS).optional(),
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
		variant: z.enum(GIFTS_VARIANTS).optional(),
		title: optionalText(200),
		subtitle: optionalText(500),
		presentation: z.enum(GIFTS_PRESENTATIONS).optional(),
		items: z.array(giftItemSchema).optional(),
	})
	.strict()
	.superRefine((gifts, context) => {
		const presentation = gifts.presentation ?? 'catalog';
		const items = gifts.items ?? [];
		if (presentation === 'legend-only' && items.length > 0) {
			context.addIssue({
				code: 'custom',
				path: ['items'],
				message: 'legend-only no admite ítems de catálogo.',
			});
		}
	});

export const countdownEditorSchema = z
	.object({
		variant: z.enum(COUNTDOWN_VARIANTS).optional(),
		title: optionalText(200),
		footerText: optionalText(500),
		presentationOptions: z
			.object({
				visibleUnits: z.array(z.enum(COUNTDOWN_UNITS)).min(1).max(4).optional(),
			})
			.strict()
			.optional(),
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
		guestPlacement: z.enum(['inside-envelope', 'outside-envelope']).optional(),
		sealStyle: z.enum(['wax', 'ribbon', 'flower', 'monogram']).optional(),
		sealIcon: z
			.enum([
				'boot',
				'heart',
				'monogram',
				'wax-monogram',
				'wax-organic',
				'wax-medallion',
				'flower',
				'special-edition',
			])
			.optional(),
		sealInitials: z.string().trim().max(4).optional(),
		sealColor: z.enum(ENVELOPE_SEAL_COLORS).optional(),
		sealVariant: z.enum(['wax-organic', 'wax-medallion', 'premium-rose']).optional(),
		sealImage: editableAssetSchema.optional(),
		microcopy: z.string().max(100).optional(),
		documentLabel: z.string().max(60).optional(),
		stampText: z.string().max(60).optional(),
		stampYear: z.string().max(10).optional(),
		tooltipText: z.string().max(100).optional(),
		teaserDetails: z.string().trim().max(500).optional(),
		variant: z.enum(THEME_PRESETS).optional(),
		revealVariant: z.enum(['celestial-blue', 'editorial-cover']).optional(),
		coverEdition: z.string().trim().max(80).optional(),
		coverVolume: z.string().trim().max(40).optional(),
		coverIssue: z.string().trim().max(40).optional(),
		closedPalette: z
			.object({
				primary: ColorTokenSchema.optional(),
				accent: ColorTokenSchema.optional(),
				background: ColorTokenSchema.optional(),
			})
			.optional(),
	})
	.strict();
