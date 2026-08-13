import { ManagedBaselineError } from './managed-merge-baseline.ts';
import {
	MergeConflictError,
	listDriftConflicts,
	type SemanticFieldDelta,
} from './semantic-delta.ts';

export type PromotionDifferenceClass =
	| 'SAFE_MANAGED_CHANGE'
	| 'TARGET_OWNED_DIFFERENCE'
	| 'MANAGED_DIVERGENCE'
	| 'CONFLICT_REQUIRES_REVIEW';

export interface PromotionDifference {
	classification: PromotionDifferenceClass;
	path: string;
	detail: string;
	previousCanonicalValue?: unknown;
	packageValue?: unknown;
	targetValue?: unknown;
}

export interface PromotionDivergenceSummary {
	safeManagedChanges: PromotionDifference[];
	targetOwnedDifferences: PromotionDifference[];
	managedDivergences: PromotionDifference[];
	conflicts: PromotionDifference[];
	blocksPromotion: boolean;
}

export function classifyPromotionDifferences(
	deltas: SemanticFieldDelta[],
): PromotionDivergenceSummary {
	const safeManagedChanges: PromotionDifference[] = [];
	const targetOwnedDifferences: PromotionDifference[] = [];
	const managedDivergences: PromotionDifference[] = [];
	const conflicts: PromotionDifference[] = [];

	for (const delta of deltas) {
		const base = {
			path: delta.path,
			previousCanonicalValue: delta.previousCanonicalValue,
			packageValue: delta.currentCanonicalValue,
			targetValue: delta.currentTargetValue,
		};
		if (delta.status === 'APPLY') {
			safeManagedChanges.push({
				...base,
				classification: 'SAFE_MANAGED_CHANGE',
				detail: `Managed field will apply (${delta.operation}).`,
			});
		} else if (delta.status === 'BLOCKED_BY_SCOPE') {
			targetOwnedDifferences.push({
				...base,
				classification: 'TARGET_OWNED_DIFFERENCE',
				detail: 'Target-owned / out-of-scope difference preserved.',
			});
		} else if (delta.status === 'DRIFT') {
			managedDivergences.push({
				...base,
				classification: 'MANAGED_DIVERGENCE',
				detail: 'Unresolved managed divergence blocks promotion.',
			});
		}
	}

	return {
		safeManagedChanges,
		targetOwnedDifferences,
		managedDivergences,
		conflicts,
		blocksPromotion: managedDivergences.length > 0 || conflicts.length > 0,
	};
}

export function divergenceFromMergeConflict(error: unknown): PromotionDivergenceSummary | null {
	let current: unknown = error;
	while (current) {
		if (current instanceof MergeConflictError) {
			const summary = classifyPromotionDifferences(listDriftConflicts(current.deltas));
			if (summary.managedDivergences.length === 0 && summary.conflicts.length === 0) {
				return {
					...summary,
					conflicts: [
						{
							classification: 'CONFLICT_REQUIRES_REVIEW',
							path: '(merge)',
							detail: current.message,
						},
					],
					blocksPromotion: true,
				};
			}
			return summary;
		}
		if (current instanceof Error && 'cause' in current && current.cause) {
			current = current.cause;
			continue;
		}
		break;
	}
	return null;
}

export function emptyDivergence(): PromotionDivergenceSummary {
	return {
		safeManagedChanges: [],
		targetOwnedDifferences: [],
		managedDivergences: [],
		conflicts: [],
		blocksPromotion: false,
	};
}

export function divergenceFromManagedBaseline(error: unknown): PromotionDivergenceSummary | null {
	let current: unknown = error;
	while (current) {
		if (current instanceof ManagedBaselineError) {
			return {
				...emptyDivergence(),
				managedDivergences: [
					{
						classification: 'MANAGED_DIVERGENCE',
						path: '(managed baseline)',
						detail: `La procedencia administrada no coincide con el estado vivo (${current.classification}).`,
					},
				],
				blocksPromotion: true,
			};
		}
		if (current instanceof Error && 'cause' in current && current.cause) {
			current = current.cause;
			continue;
		}
		break;
	}
	return null;
}
