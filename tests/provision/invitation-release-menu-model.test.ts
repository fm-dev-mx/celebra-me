import { describe, expect, it } from '@jest/globals';
import {
	releaseDefaultAction,
	releaseNextStep,
	releaseRootMenu,
	type ReleaseMenuState,
} from '../../scripts/provision/invitation-release-menu-model.ts';

function state(overrides: Partial<ReleaseMenuState> = {}): ReleaseMenuState {
	return {
		promotionAction: 'UNKNOWN',
		productionReady: false,
		hasPendingPreviewApproval: false,
		lastAction: null,
		...overrides,
	};
}

describe('invitation:release menu model', () => {
	it('orders the root menu by release chronology and shows approval only when pending', () => {
		expect(releaseRootMenu(state()).order).toEqual([
			'local',
			'prepare_preview',
			'production',
			'status',
			'tools',
			'change',
			'exit',
		]);
		expect(releaseRootMenu(state({ hasPendingPreviewApproval: true })).order).toContain(
			'approve_preview',
		);
	});

	it('preselects the most likely step from the dbs publication action', () => {
		expect(releaseDefaultAction(state({ promotionAction: 'PROMOTE_PREVIEW' }))).toBe(
			'prepare_preview',
		);
		expect(
			releaseDefaultAction(
				state({ promotionAction: 'PROMOTE_PRODUCTION', productionReady: true }),
			),
		).toBe('production');
		expect(
			releaseDefaultAction(
				state({ promotionAction: 'PROMOTE_PRODUCTION', hasPendingPreviewApproval: true }),
			),
		).toBe('approve_preview');
		expect(releaseDefaultAction(state({ promotionAction: 'PROMOTE_PRODUCTION' }))).toBe(
			'prepare_preview',
		);
		for (const action of ['NONE', 'BLOCKED', 'UNKNOWN'] as const)
			expect(releaseDefaultAction(state({ promotionAction: action }))).toBe('local');
	});

	it('offers the following stage after each action instead of the root menu', () => {
		expect(releaseNextStep(state({ lastAction: 'local' })).initial).toBe('prepare_preview');
		expect(
			releaseNextStep(
				state({ lastAction: 'prepare_preview', hasPendingPreviewApproval: true }),
			).initial,
		).toBe('approve_preview');
		expect(
			releaseNextStep(state({ lastAction: 'approve_preview', productionReady: true }))
				.initial,
		).toBe('production');
		expect(releaseNextStep(state({ lastAction: 'approve_preview' })).initial).toBe('menu');
		expect(releaseNextStep(state({ lastAction: 'production' })).initial).toBe('exit');
		expect(releaseNextStep(state({ lastAction: 'status' })).initial).toBe('menu');
	});
});
