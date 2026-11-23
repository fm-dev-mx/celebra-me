import { z } from 'zod';
import {
	CONTENT_SECTION_KEYS,
	INVITATION_RENDER_SECTION_KEYS,
	SECTION_INTERSECTION_FAMILIES,
	SECTION_ORNAMENT_SETS,
} from '@/lib/theme/theme-contract';

/** Footer variants. The footer stays outside the section registry: it renders on every page. */
export const FOOTER_VARIANTS = ['standard', 'framed-closing', 'foil-colophon'] as const;
export type FooterVariant = (typeof FOOTER_VARIANTS)[number];

const RENDER_PLAN_TARGETS = [
	...CONTENT_SECTION_KEYS,
	'personalized-access',
	'dress-code',
	...INVITATION_RENDER_SECTION_KEYS.map((section) => `interlude-after-${section}` as const),
] as const;

export type RenderPlanTarget = (typeof RENDER_PLAN_TARGETS)[number];

const RENDER_PLAN_INTERSECTION_SOURCES = ['hero', ...RENDER_PLAN_TARGETS] as const;

const renderPlanIntersectionSchema = z
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
		ornaments: z.enum(SECTION_ORNAMENT_SETS).optional(),
		/** Closing band variant; `framed-closing` loads `footer/_framed-closing.scss`. */
		footerVariant: z.enum(FOOTER_VARIANTS).optional(),
	})
	.strict();

export type InvitationComposition = z.infer<typeof invitationCompositionSchema>;

export function resolveRenderPlanIntersection(
	composition: InvitationComposition,
	target: RenderPlanTarget,
): RenderPlanIntersection {
	return composition.intersections[target] ?? { family: 'neutral', source: target };
}
