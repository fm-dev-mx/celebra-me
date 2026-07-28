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

	it('defaults unknown profiles to a neutral boundary', () => {
		expect(resolveRenderPlanIntersection('unknown-profile', 'gallery')).toEqual({
			family: 'neutral',
			source: 'gallery',
		});
	});
});
