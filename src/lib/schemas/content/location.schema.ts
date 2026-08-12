import { z } from 'zod';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import { LOCATION_PRESENTATIONS } from '@/lib/invitation/presentation-options';
import { LOCATION_STRUCTURAL_VARIANTS } from '@/lib/invitation/structural-variants';

const locationCoordinatesSchema = z
	.object({
		lat: z.number().min(-90).max(90),
		lng: z.number().min(-180).max(180),
		zoom: z.number().min(1).max(22).optional(),
	})
	.optional();

/** Navigable http(s) URL, or a preparation placeholder that must fail closed at render. */
const venueMapUrlSchema = z
	.union([z.url(), z.string().regex(/^\[\[PENDIENTE:[A-Z0-9_]+\]\]$/u)])
	.optional();

const venueSchema = z.object({
	venueEvent: z.string(),
	venueName: z.string(),
	address: z.string(),
	city: z.string().optional(),
	date: z.string(),
	time: z.string(),
	mapUrl: venueMapUrlSchema,
	appleMapsUrl: venueMapUrlSchema,
	googleMapsUrl: venueMapUrlSchema,
	wazeUrl: venueMapUrlSchema,
	image: AssetSchema.optional(),
	focalPoint: focalPointSchema.optional(),
	coordinates: locationCoordinatesSchema,
});

const venueEntrySchema = z.object({
	type: z.enum(['ceremony', 'reception', 'custom']),
	label: z.string().optional(),
	id: z.string().optional(),
	eventType: z.string().optional(),
	venueEvent: z.string(),
	venueName: z.string(),
	address: z.string(),
	city: z.string().optional(),
	date: z.string(),
	time: z.string(),
	mapUrl: venueMapUrlSchema,
	appleMapsUrl: venueMapUrlSchema,
	googleMapsUrl: venueMapUrlSchema,
	wazeUrl: venueMapUrlSchema,
	image: AssetSchema.optional(),
	focalPoint: focalPointSchema.optional(),
	coordinates: locationCoordinatesSchema,
	isVisible: z.boolean().optional().default(true),
	sortOrder: z.number().int().min(0).optional(),
});

export type VenueEntryInput = z.infer<typeof venueEntrySchema>;

const locationBaseSchema = z.object({
	visibility: z.enum(['public', 'after-rsvp']).default('public'),
	presentation: z.enum(LOCATION_PRESENTATIONS).optional(),
	presentationOptions: z
		.object({
			showFlourishes: z.boolean().optional(),
			showNavigationButtons: z.boolean().optional(),
			revealSurface: z.enum(['section', 'rsvp']).optional(),
		})
		.strict()
		.optional(),
	introEyebrow: z.string().optional(),
	introHeading: z.string().optional(),
	introLede: z.string().optional(),
	indicationsHeading: z.string().default(''),
	ceremony: venueSchema
		.extend({
			venueEvent: z.string().default('Ceremonia'),
		})
		.optional(),
	reception: venueSchema
		.extend({
			venueEvent: z.string().default('Recepción'),
		})
		.optional(),
	venues: z.array(venueEntrySchema).optional(),
	indications: z
		.array(
			z.object({
				iconName: z.enum(ICON_NAMES_TUPLE),
				styleVariant: z.enum(INDICATION_STYLE_VARIANTS).default('default'),
				text: z.string(),
			}),
		)
		.optional(),
});

export const locationSchema = z
	.discriminatedUnion('variant', [
		locationBaseSchema.extend({ variant: z.literal(LOCATION_STRUCTURAL_VARIANTS[0]) }),
		locationBaseSchema.extend({ variant: z.literal(LOCATION_STRUCTURAL_VARIANTS[1]) }),
	])
	.superRefine((location, context) => {
		if (location.variant !== 'split-map') return;
		const venues = [
			location.ceremony,
			location.reception,
			...(location.venues?.filter((venue) => venue.isVisible !== false) ?? []),
		].filter(Boolean);
		if (venues.some((venue) => venue?.coordinates || venue?.image)) return;
		context.addIssue({
			code: 'custom',
			path: ['variant'],
			message:
				'location.variant=split-map requires at least one visible venue with coordinates or image media',
		});
	});
