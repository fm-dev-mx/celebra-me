import { z } from 'zod';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';
import {
	LOCATION_INDICATIONS_LAYOUTS,
	LOCATION_SCENES,
	LOCATION_INDICATIONS_STYLES,
	LOCATION_VENUE_CARDS,
	LOCATION_MAP_STYLES,
	LOCATION_PRESENTATIONS,
} from '@/lib/invitation/location-presentation';
import { LOCATION_VARIANTS } from '@/lib/invitation/section-variants';

/** Variants built on the shared venue plates: two or more venues, optional compact cards. */
const PLATE_VARIANTS: ReadonlySet<string> = new Set(['stacked-venue-plates', 'night-route']);

/** Variants that lay out a route between venues and so need two or more of them. */
const MULTI_VENUE_VARIANTS: ReadonlySet<string> = new Set([...PLATE_VARIANTS, 'star-route']);

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
	accessPolicy: z
		.object({
			visibility: z.enum(['public', 'after-rsvp']),
			revealPlacement: z.enum(['section', 'rsvp']).optional(),
		})
		.strict()
		.optional(),
	presentation: z.enum(LOCATION_PRESENTATIONS).optional(),
	mapStyle: z.enum(LOCATION_MAP_STYLES).default('dark'),
	presentationOptions: z
		.object({
			showFlourishes: z.boolean().optional(),
			showNavigationButtons: z.boolean().optional(),
			revealSurface: z.enum(['section', 'rsvp']).optional(),
			indicationsLayout: z.enum(LOCATION_INDICATIONS_LAYOUTS).optional(),
			indicationsStyle: z.enum(LOCATION_INDICATIONS_STYLES).optional(),
			showCalendarLinks: z.boolean().optional(),
			scene: z.enum(LOCATION_SCENES).optional(),
			venueCard: z.enum(LOCATION_VENUE_CARDS).optional(),
		})
		.strict()
		.optional(),
	introEyebrow: z.string().optional(),
	introHeading: z.string().optional(),
	introLede: z.string().optional(),
	/** Decorative cutout (transparent image) printed after the intro; contained, never cropped. */
	ornament: AssetSchema.optional(),
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

function collectVisibleVenues(location: { venues: Array<{ isVisible?: boolean }> }): unknown[] {
	return location.venues.filter((venue) => venue.isVisible !== false);
}

function validateRouteScene(
	scene: string,
	location: { variant: string; venues: Array<{ isVisible?: boolean }> },
	context: z.RefinementCtx,
): void {
	if (location.variant === 'program-sheet' && collectVisibleVenues(location).length >= 2) return;
	context.addIssue({
		code: 'custom',
		path: ['presentationOptions', 'scene'],
		message: `location.presentationOptions.scene=${scene} requires program-sheet with at least two visible venues`,
	});
}

export const locationSchema = z
	.discriminatedUnion('variant', [
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[0]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[1]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[2]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[3]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[4]) }),
		locationBaseSchema.strict().extend({ variant: z.literal(LOCATION_VARIANTS[5]) }),
	])
	.superRefine((location, context) => {
		if (
			location.accessPolicy?.visibility === 'after-rsvp' &&
			!location.accessPolicy.revealPlacement
		) {
			context.addIssue({
				code: 'custom',
				path: ['accessPolicy', 'revealPlacement'],
				message:
					'location.accessPolicy.revealPlacement is required for after-rsvp visibility',
			});
		}
		if (
			location.accessPolicy?.visibility === 'public' &&
			location.accessPolicy.revealPlacement !== undefined
		) {
			context.addIssue({
				code: 'custom',
				path: ['accessPolicy', 'revealPlacement'],
				message:
					'location.accessPolicy.revealPlacement is only valid for after-rsvp visibility',
			});
		}

		if (location.presentationOptions?.scene) {
			validateRouteScene(location.presentationOptions.scene, location, context);
		}

		if (
			location.presentationOptions?.venueCard === 'compact' &&
			!PLATE_VARIANTS.has(location.variant ?? '')
		) {
			context.addIssue({
				code: 'custom',
				path: ['presentationOptions', 'venueCard'],
				message:
					'location.presentationOptions.venueCard=compact requires stacked-venue-plates or night-route',
			});
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

		if (MULTI_VENUE_VARIANTS.has(location.variant ?? '')) {
			const venues = collectVisibleVenues(location);
			if (venues.length >= 2) return;
			context.addIssue({
				code: 'custom',
				path: ['variant'],
				message: `location.variant=${location.variant} requires at least two visible venues`,
			});
			return;
		}

		if (location.variant === 'program-sheet') {
			if (collectVisibleVenues(location).length >= 1) return;
			context.addIssue({
				code: 'custom',
				path: ['variant'],
				message: 'location.variant=program-sheet requires at least one visible venue',
			});
		}
	});
