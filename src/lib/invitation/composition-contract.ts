import { z } from 'zod';
import { CONTENT_SECTION_KEYS, SECTION_INTERSECTION_FAMILIES } from '@/lib/theme/theme-contract';

export const RENDER_PLAN_TARGETS = [
	...CONTENT_SECTION_KEYS,
	'personalized-access',
	...CONTENT_SECTION_KEYS.map((section) => `interlude-after-${section}` as const),
] as const;

export type RenderPlanTarget = (typeof RENDER_PLAN_TARGETS)[number];

export const RENDER_PLAN_INTERSECTION_SOURCES = ['hero', ...RENDER_PLAN_TARGETS] as const;

export const renderPlanIntersectionSchema = z
	.object({
		family: z.enum(SECTION_INTERSECTION_FAMILIES),
		source: z.enum(RENDER_PLAN_INTERSECTION_SOURCES),
	})
	.strict();

export type RenderPlanIntersection = z.infer<typeof renderPlanIntersectionSchema>;

export const invitationCompositionSchema = z
	.object({
		intersections: z
			.partialRecord(z.enum(RENDER_PLAN_TARGETS), renderPlanIntersectionSchema)
			.default({}),
	})
	.strict()
	.optional();

export type InvitationComposition = z.infer<typeof invitationCompositionSchema>;

export function resolveRenderPlanIntersection(
	composition: InvitationComposition,
	target: RenderPlanTarget,
): RenderPlanIntersection {
	return composition?.intersections[target] ?? { family: 'neutral', source: target };
}
