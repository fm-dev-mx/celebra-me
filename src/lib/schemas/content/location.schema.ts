import { z } from 'zod';
import {
	INDICATION_ICON_KEYS,
	INDICATION_ICON_NAMES,
	INDICATION_STYLE_VARIANTS,
} from '@/lib/theme/theme-contract';
import { itineraryItemSchema } from '@/lib/schemas/content/itinerary.schema';
import { AssetSchema, countdownSchema } from '@/lib/schemas/content/shared.schema';

const locationCoordinatesSchema = z.object({ lat: z.number(), lng: z.number() }).optional();
const richTextSchema = z.string();

const venueSchema = z.object({
	venueEvent: z.string(),
	venueName: z.string(),
	address: z.string(),
	date: z.string(),
	time: z.string(),
	mapUrl: z.url().optional(),
	appleMapsUrl: z.url().optional(),
	googleMapsUrl: z.url().optional(),
	wazeUrl: z.url().optional(),
	image: AssetSchema.optional(),
	coordinates: locationCoordinatesSchema,
});

export const locationSchema = z.object({
	venueName: z.string(),
	address: z.string(),
	city: z.string(),
	mapUrl: z.url().optional(),
	ceremony: venueSchema
		.extend({
			venueEvent: z.string().default('Ceremonia'),
		})
		.optional(),
	reception: venueSchema
		.extend({
			venueEvent: z.string().default('Recepción'),
			itinerary: z
				.array(
					itineraryItemSchema.omit({
						description: true,
					}),
				)
				.optional(),
			countdown: countdownSchema,
		})
		.optional(),
	indications: z
		.array(
			z.object({
				icon: z.enum(INDICATION_ICON_KEYS),
				iconName: z.enum(INDICATION_ICON_NAMES).optional(),
				styleVariant: z.enum(INDICATION_STYLE_VARIANTS).default('default'),
				text: richTextSchema,
			}),
		)
		.optional(),
});
