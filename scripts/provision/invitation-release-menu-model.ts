/**
 * Pure menu model for the interactive pnpm invitation:release flow.
 * Ordering follows the release chronology (Local → Preview → approve → Production dry-run);
 * the default item follows the publication state detected with the same SSOT as pnpm dbs.
 */
import type { PromotionAction } from '../../src/lib/status/types.ts';
import { defaultDestinationFromPromotionAction } from './invitation-release-destination.ts';

export type ReleaseMenuAction =
	| 'local'
	| 'prepare_preview'
	| 'approve_preview'
	| 'production'
	| 'status'
	| 'tools'
	| 'change'
	| 'menu'
	| 'exit';

export interface ReleaseMenuState {
	promotionAction: PromotionAction;
	productionReady: boolean;
	hasPendingPreviewApproval: boolean;
	lastAction: ReleaseMenuAction | null;
}

/** Root order (labels are rendered by the wizard) and the state-driven default. */
export function releaseRootMenu(state: ReleaseMenuState): {
	order: ReleaseMenuAction[];
	initial: ReleaseMenuAction;
} {
	const order: ReleaseMenuAction[] = ['local', 'prepare_preview'];
	if (state.hasPendingPreviewApproval) order.push('approve_preview');
	order.push('production', 'status', 'tools', 'change', 'exit');
	return { order, initial: releaseDefaultAction(state) };
}

export function releaseDefaultAction(state: ReleaseMenuState): ReleaseMenuAction {
	const destination = defaultDestinationFromPromotionAction(state.promotionAction);
	if (destination === 'production') {
		if (state.productionReady) return 'production';
		return state.hasPendingPreviewApproval ? 'approve_preview' : 'prepare_preview';
	}
	if (destination === 'prepare_preview') return 'prepare_preview';
	return 'local';
}

/** Next step after an action: the following release stage first, never the root by default. */
export function releaseNextStep(state: ReleaseMenuState): {
	order: ReleaseMenuAction[];
	initial: ReleaseMenuAction;
} {
	switch (state.lastAction) {
		case 'local':
			return { order: ['prepare_preview', 'menu', 'exit'], initial: 'prepare_preview' };
		case 'prepare_preview':
			if (state.hasPendingPreviewApproval)
				return { order: ['approve_preview', 'menu', 'exit'], initial: 'approve_preview' };
			return {
				order: ['production', 'menu', 'exit'],
				initial: state.productionReady ? 'production' : 'menu',
			};
		case 'approve_preview':
			return {
				order: ['production', 'menu', 'exit'],
				initial: state.productionReady ? 'production' : 'menu',
			};
		case 'production':
			return { order: ['exit', 'menu'], initial: 'exit' };
		default:
			return { order: ['menu', 'exit'], initial: 'menu' };
	}
}
