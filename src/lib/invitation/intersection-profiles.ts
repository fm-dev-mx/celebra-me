import type { ContentSectionKey, SectionIntersectionFamily } from '@/lib/theme/theme-contract';

type RenderPlanTarget =
	ContentSectionKey | 'personalized-access' | `interlude-after-${ContentSectionKey}`;

export interface RenderPlanIntersection {
	family: SectionIntersectionFamily;
	source: 'hero' | RenderPlanTarget;
}

type IntersectionProfile = Partial<Record<RenderPlanTarget, RenderPlanIntersection>>;

/**
 * Explicit composition metadata. Profile identity selects the mapping; section order and
 * adjacency never select a treatment. The render plan copies the resolved values onto stable
 * wrapper attributes consumed by shared intersection primitives.
 */
const INTERSECTION_PROFILES: Readonly<Record<string, IntersectionProfile>> = {
	'abril-michelle-becerra-rea': {
		quote: { family: 'atmospheric-blend', source: 'hero' },
		'interlude-after-quote': { family: 'overlap', source: 'quote' },
		family: { family: 'atmospheric-blend', source: 'interlude-after-quote' },
		countdown: { family: 'atmospheric-blend', source: 'family' },
		location: { family: 'atmospheric-blend', source: 'countdown' },
		'interlude-after-location': { family: 'overlap', source: 'location' },
		itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
		rsvp: { family: 'arch', source: 'gallery' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
	},
	'demo-xv-celestial-blue': {
		'interlude-after-location': { family: 'arch', source: 'location' },
		'interlude-after-rsvp': { family: 'atmospheric-blend', source: 'rsvp' },
	},
};

export function resolveRenderPlanIntersection(
	profileId: string | undefined,
	target: RenderPlanTarget,
): RenderPlanIntersection {
	return (
		INTERSECTION_PROFILES[profileId ?? '']?.[target] ?? {
			family: 'neutral',
			source: target,
		}
	);
}
