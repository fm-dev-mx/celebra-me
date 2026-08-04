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
		'interlude-after-family': { family: 'overlap', source: 'family' },
		gallery: { family: 'atmospheric-blend', source: 'interlude-after-family' },
		'interlude-after-location': { family: 'arch', source: 'location' },
		'interlude-after-itinerary': { family: 'overlap', source: 'itinerary' },
		'interlude-after-rsvp': { family: 'atmospheric-blend', source: 'rsvp' },
	},
	'alba-rosa-quinonez': {
		// Quiet pause after the dark hero before warm Location
		countdown: { family: 'atmospheric-blend', source: 'hero' },
		location: { family: 'atmospheric-blend', source: 'countdown' },
		'interlude-after-location': { family: 'arch', source: 'location' },
		// Diagonal limestone cut over the Paris plate (asymmetric, off-center)
		gallery: { family: 'overlap', source: 'interlude-after-location' },
		// Legend pause divides gallery photography from the personal pass
		gifts: { family: 'atmospheric-blend', source: 'gallery' },
		'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
		// Restore the signature graphite diagonal into RSVP (axis-breaking cut)
		rsvp: { family: 'overlap', source: 'personalized-access' },
		family: { family: 'atmospheric-blend', source: 'rsvp' },
		// Thank You keeps the blend; the memory photo itself crosses the seam
		thankYou: { family: 'atmospheric-blend', source: 'family' },
	},
	'boda-perla-y-carlos': {
		// Restrained asymmetric system: one arch into Interlude A, one shallow overlap
		// from Interlude B into personalized access. Remaining chapters stay atmospheric.
		quote: { family: 'atmospheric-blend', source: 'hero' },
		countdown: { family: 'atmospheric-blend', source: 'quote' },
		'interlude-after-countdown': { family: 'arch', source: 'countdown' },
		location: { family: 'atmospheric-blend', source: 'interlude-after-countdown' },
		family: { family: 'atmospheric-blend', source: 'location' },
		gallery: { family: 'atmospheric-blend', source: 'family' },
		'interlude-after-gallery': { family: 'atmospheric-blend', source: 'gallery' },
		'personalized-access': { family: 'overlap', source: 'interlude-after-gallery' },
		rsvp: { family: 'atmospheric-blend', source: 'personalized-access' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
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
