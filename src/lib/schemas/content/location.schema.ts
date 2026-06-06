import { z } from 'zod';
import { iconNamesTuple } from '@/lib/icons/icon-catalog';
import { INDICATION_STYLE_VARIANTS } from '@/lib/theme/theme-contract';
import { AssetSchema, focalPointSchema } from '@/lib/schemas/content/shared.schema';

const ICON_NAMES_TUPLE = iconNamesTuple();

const locationCoordinatesSchema = z.object({ lat: z.number(), lng: z.number() }).optional();
const richTextSchema = z.string();

const venueSchema = z.object({
	venueEvent: z.string(),
	venueName: z.string(),
	address: z.string(),
	city: z.string().optional(),
	date: z.string(),
	time: z.string(),
	mapUrl: z.url().optional(),
	appleMapsUrl: z.url().optional(),
	googleMapsUrl: z.url().optional(),
	wazeUrl: z.url().optional(),
	image: AssetSchema.optional(),
	focalPoint: focalPointSchema.optional(),
	coordinates: locationCoordinatesSchema,
});

export const locationSchema = z.object({
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
	indications: z
		.array(
			z.object({
				iconName: z.enum(ICON_NAMES_TUPLE),
				styleVariant: z.enum(INDICATION_STYLE_VARIANTS).default('default'),
				text: richTextSchema,
			}),
		)
		.optional(),
});
