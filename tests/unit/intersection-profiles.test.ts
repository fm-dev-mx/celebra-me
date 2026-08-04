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

	it('maps Daniela y Martín arch, interlude bridges, and PA overlap', () => {
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'quote')).toEqual({
			family: 'atmospheric-blend',
			source: 'hero',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'countdown')).toEqual({
			family: 'atmospheric-blend',
			source: 'quote',
		});
		expect(
			resolveRenderPlanIntersection('daniela-y-martin', 'interlude-after-countdown'),
		).toEqual({
			family: 'arch',
			source: 'countdown',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'location')).toEqual({
			family: 'atmospheric-blend',
			source: 'interlude-after-countdown',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'family')).toEqual({
			family: 'atmospheric-blend',
			source: 'location',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'gallery')).toEqual({
			family: 'atmospheric-blend',
			source: 'family',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'gifts')).toEqual({
			family: 'atmospheric-blend',
			source: 'gallery',
		});
		expect(
			resolveRenderPlanIntersection('daniela-y-martin', 'interlude-after-gifts'),
		).toEqual({
			family: 'atmospheric-blend',
			source: 'gifts',
		});
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'personalized-access')).toEqual(
			{
				family: 'overlap',
				source: 'interlude-after-gifts',
			},
		);
		expect(resolveRenderPlanIntersection('daniela-y-martin', 'thankYou')).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});
	});
});
