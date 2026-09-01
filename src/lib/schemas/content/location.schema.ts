import { z } from 'zod';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import {
	LOCATION_MAP_STYLES,
	LOCATION_PRESENTATIONS,
} from '@/lib/invitation/location-presentation';
import { LOCATION_VARIANTS } from '@/lib/invitation/section-variants';

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
	accessPolicy: z.object({
		visibility: z.enum(['public', 'after-rsvp']),
		revealPlacement: z.enum(['section', 'rsvp']).optional(),
	}).strict().optional(),
	presentation: z.enum(LOCATION_PRESENTATIONS).optional(),
	mapStyle: z.enum(LOCATION_MAP_STYLES).default('dark'),
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
	venues: z.array(venueEntrySchema),
	indications: z
		.array(
			z.object({
				iconName: z.enum(ICON_NAMES_TUPLE),
				styleVariant: z.enum(INDICATION_STYLE_VARIANTS).default('default'),
				title: z.string().optional(),
				text: z.string(),
			}),
		)
		.optional(),
});

function collectVisibleVenues(location: {
	venues: Array<{ isVisible?: boolean }>;
}): unknown[] {
	return location.venues.filter((venue) => venue.isVisible !== false);
}

export const locationSchema = z
	.discriminatedUnion('variant', [
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[0]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[1]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[2]) }),
	])
	.superRefine((location, context) => {
		if (location.accessPolicy?.visibility === 'after-rsvp' && !location.accessPolicy.revealPlacement) {
			context.addIssue({ code: 'custom', path: ['accessPolicy', 'revealPlacement'], message: 'location.accessPolicy.revealPlacement is required for after-rsvp visibility' });
		}
		if (location.accessPolicy?.visibility === 'public' && location.accessPolicy.revealPlacement !== undefined) {
			context.addIssue({ code: 'custom', path: ['accessPolicy', 'revealPlacement'], message: 'location.accessPolicy.revealPlacement is only valid for after-rsvp visibility' });
		}

		if (location.variant === 'split-map') {
			const venues = collectVisibleVenues(location) as Array<{
				coordinates?: unknown;
				image?: unknown;
			}>;
			if (venues.some((venue) => venue?.coordinates || venue?.image)) return;
			context.addIssue({
				code: 'custom',
				path: ['variant'],
				message:
					'location.variant=split-map requires at least one visible venue with coordinates or image media',
			});
			return;
		}

		if (location.variant === 'stacked-venue-plates') {
			const venues = collectVisibleVenues(location);
			if (venues.length >= 2) return;
			context.addIssue({
				code: 'custom',
				path: ['variant'],
				message:
					'location.variant=stacked-venue-plates requires at least two visible venues',
			});
		}
	});
