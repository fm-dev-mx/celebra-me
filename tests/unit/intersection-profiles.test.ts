import { resolveRenderPlanIntersection } from '@/lib/invitation/intersection-profiles';

describe('invitation intersection profiles', () => {
	it('keeps Abril composition explicit and behavior-named', () => {
		expect(
			resolveRenderPlanIntersection('abril-michelle-becerra-rea', 'interlude-after-quote'),
		).toEqual({ family: 'overlap', source: 'quote' });
		expect(resolveRenderPlanIntersection('abril-michelle-becerra-rea', 'rsvp')).toEqual({
			family: 'arch',
			source: 'gallery',
		});
		expect(resolveRenderPlanIntersection('abril-michelle-becerra-rea', 'thankYou')).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});
	});

	it('maps Celestial bridges and climaxes explicitly', () => {
		expect(
			resolveRenderPlanIntersection('demo-xv-celestial-blue', 'interlude-after-family'),
		).toEqual({
			family: 'overlap',
			source: 'family',
		});
		expect(resolveRenderPlanIntersection('demo-xv-celestial-blue', 'gallery')).toEqual({
			family: 'atmospheric-blend',
			source: 'interlude-after-family',
		});
		expect(
			resolveRenderPlanIntersection('demo-xv-celestial-blue', 'interlude-after-location'),
		).toEqual({
			family: 'arch',
			source: 'location',
		});
		expect(
			resolveRenderPlanIntersection('demo-xv-celestial-blue', 'interlude-after-itinerary'),
		).toEqual({
			family: 'overlap',
			source: 'itinerary',
		});
		expect(
			resolveRenderPlanIntersection('demo-xv-celestial-blue', 'interlude-after-rsvp'),
		).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});
	});

	it('defaults unknown profiles to a neutral boundary', () => {
		expect(resolveRenderPlanIntersection('unknown-profile', 'gallery')).toEqual({
			family: 'neutral',
			source: 'gallery',
		});
	});

	it('maps Alba Rosa pause dividers and the RSVP diagonal cut', () => {
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'countdown')).toEqual({
			family: 'atmospheric-blend',
			source: 'hero',
		});
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'location')).toEqual({
			family: 'atmospheric-blend',
			source: 'countdown',
		});
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'gifts')).toEqual({
			family: 'atmospheric-blend',
			source: 'gallery',
		});
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'personalized-access')).toEqual({
			family: 'atmospheric-blend',
			source: 'gifts',
		});
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'rsvp')).toEqual({
			family: 'overlap',
			source: 'personalized-access',
		});
		expect(resolveRenderPlanIntersection('alba-rosa-quinonez', 'gallery')).toEqual({
			family: 'overlap',
			source: 'interlude-after-location',
		});
	});

	it('maps Perla y Carlos arch, interlude bridges, and PA overlap', () => {
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'quote')).toEqual({
			family: 'atmospheric-blend',
			source: 'hero',
		});
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'countdown')).toEqual({
			family: 'atmospheric-blend',
			source: 'quote',
		});
		expect(
			resolveRenderPlanIntersection('boda-perla-y-carlos', 'interlude-after-countdown'),
		).toEqual({
			family: 'arch',
			source: 'countdown',
		});
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'location')).toEqual({
			family: 'atmospheric-blend',
			source: 'interlude-after-countdown',
		});
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'family')).toEqual({
			family: 'atmospheric-blend',
			source: 'location',
		});
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'gallery')).toEqual({
			family: 'atmospheric-blend',
			source: 'family',
		});
		expect(
			resolveRenderPlanIntersection('boda-perla-y-carlos', 'interlude-after-gallery'),
		).toEqual({
			family: 'atmospheric-blend',
			source: 'gallery',
		});
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'personalized-access')).toEqual(
			{
				family: 'overlap',
				source: 'interlude-after-gallery',
			},
		);
		expect(resolveRenderPlanIntersection('boda-perla-y-carlos', 'thankYou')).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});
	});
});
