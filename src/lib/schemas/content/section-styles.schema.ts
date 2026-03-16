import { z } from 'astro:content';
import {
	COUNTDOWN_NUMBER_STYLES,
	COUNTDOWN_VARIANTS,
	ITINERARY_VARIANTS,
	LOCATION_MAP_STYLES,
	LOCATION_VARIANTS,
	QUOTE_ANIMATIONS,
	QUOTE_FONT_STYLES,
	QUOTE_VARIANTS,
	SHARED_SECTION_VARIANTS,
} from '@/lib/theme/theme-contract';
import { rsvpSectionStyleSchema } from '@/lib/schemas/content/rsvp.schema';

export const sectionStylesSchema = z
	.object({
		quote: z
			.object({
				variant: z.enum(QUOTE_VARIANTS).default('elegant'),
				fontStyle: z.enum(QUOTE_FONT_STYLES).optional(),
				animation: z.enum(QUOTE_ANIMATIONS).default('fade'),
			})
			.optional(),
		countdown: z
			.object({
				variant: z.enum(COUNTDOWN_VARIANTS).default('minimal'),
				numberStyle: z.enum(COUNTDOWN_NUMBER_STYLES).default('thin'),
				showParticles: z.boolean().default(false),
			})
			.optional(),
		location: z
			.object({
				variant: z.enum(LOCATION_VARIANTS).default('structured'),
				mapStyle: z.enum(LOCATION_MAP_STYLES).default('dark'),
				showFlourishes: z.boolean().default(true),
			})
			.optional(),
		family: z
			.object({ variant: z.enum(SHARED_SECTION_VARIANTS).default('standard') })
			.optional(),
		gifts: z
			.object({ variant: z.enum(SHARED_SECTION_VARIANTS).default('standard') })
			.optional(),
		gallery: z
			.object({ variant: z.enum(SHARED_SECTION_VARIANTS).default('standard') })
			.optional(),
		itinerary: z.object({ variant: z.enum(ITINERARY_VARIANTS).default('base') }).optional(),
		thankYou: z
			.object({ variant: z.enum(SHARED_SECTION_VARIANTS).default('standard') })
			.optional(),
		rsvp: rsvpSectionStyleSchema,
	})
	.optional();
