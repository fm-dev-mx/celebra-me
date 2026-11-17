import { z } from 'zod';
import { ICON_NAMES_TUPLE } from '@/lib/icons/icon-catalog';
import { ITINERARY_VARIANTS } from '@/lib/invitation/section-variants';

/** Pinned scroll scenes the standard itinerary can play (docs/domains/theme/motion.md). */
const ITINERARY_SCENES = ['ribbon-route'] as const;
export type ItineraryScene = (typeof ITINERARY_SCENES)[number];

const itineraryItemSchema = z.object({
	iconName: z.enum(ICON_NAMES_TUPLE),
	label: z.string(),
	description: z.string().optional(),
	time: z.string(),
});

export const itinerarySchema = z
	.object({
		title: z.string().default('Itinerario'),
		subtitle: z.string().optional(),
		variant: z.enum(ITINERARY_VARIANTS),
		items: z.array(itineraryItemSchema),
		closingNote: z.string().optional(),
		timeFormat: z.enum(['12h', '12h-es']).optional(),
		scene: z.enum(ITINERARY_SCENES).optional(),
	})
	.strict()
	.superRefine((itinerary, context) => {
		if (itinerary.timeFormat && (itinerary.variant !== 'standard' || itinerary.scene)) {
			context.addIssue({
				code: 'custom',
				path: ['timeFormat'],
				message:
					'itinerary.timeFormat requires the standard timeline without a pinned scene',
			});
		}
		if (!itinerary.scene) return;
		if (itinerary.variant === 'standard' && itinerary.items.length >= 2) return;
		context.addIssue({
			code: 'custom',
			path: ['scene'],
			message: `itinerary.scene=${itinerary.scene} requires the standard variant with at least two items`,
		});
	})
	.optional();
