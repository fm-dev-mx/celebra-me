import {
	resolveRenderPlanIntersection,
	type InvitationComposition,
} from '@/lib/invitation/composition-contract';

const composition: InvitationComposition = {
	intersections: {
		quote: { family: 'atmospheric-blend', source: 'hero' },
		'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
		location: { family: 'arch', source: 'interlude-after-countdown' },
		rsvp: { family: 'atmospheric-blend', source: 'personalized-access' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
	},
};

describe('invitation composition contract', () => {
	it('resolves explicit behavior-named intersections without invitation identity', () => {
		expect(resolveRenderPlanIntersection(composition, 'quote')).toEqual({
			family: 'atmospheric-blend',
			source: 'hero',
		});
		expect(resolveRenderPlanIntersection(composition, 'interlude-after-countdown')).toEqual({
			family: 'overlap',
			source: 'countdown',
		});
		expect(resolveRenderPlanIntersection(composition, 'location')).toEqual({
			family: 'arch',
			source: 'interlude-after-countdown',
		});
	});

	it('defaults missing composition entries to a neutral self-owned boundary', () => {
		expect(resolveRenderPlanIntersection(composition, 'gallery')).toEqual({
			family: 'neutral',
			source: 'gallery',
		});
		expect(resolveRenderPlanIntersection({ intersections: {} }, 'rsvp')).toEqual({
			family: 'neutral',
			source: 'rsvp',
		});
	});

	it('keeps downstream boundary sources explicit in configuration', () => {
		expect(resolveRenderPlanIntersection(composition, 'rsvp')).toEqual({
			family: 'atmospheric-blend',
			source: 'personalized-access',
		});
		expect(resolveRenderPlanIntersection(composition, 'thankYou')).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});
	});
});
