/** Builds managed reconciliation persistence inputs without introducing a DB writer. */
import type { ConflictResolutions } from './semantic-delta.ts';
import type { ReconciliationDecisionOutcome } from './reconciliation-state.ts';

export interface ReconciliationManagedApplyPlan {
	conflictResolutions: ConflictResolutions;
	keepCanonicalPaths: string[];
	keepEnvironmentPaths: string[];
}

export function buildReconciliationManagedApplyPlan(
	decisions: Record<string, ReconciliationDecisionOutcome>,
): ReconciliationManagedApplyPlan {
	const conflictResolutions: ConflictResolutions = {};
	const keepCanonicalPaths: string[] = [];
	const keepEnvironmentPaths: string[] = [];

	for (const [path, decision] of Object.entries(decisions)) {
		if (decision === 'KEEP_CANONICAL') {
			conflictResolutions[path] = 'package';
			keepCanonicalPaths.push(path);
		} else if (decision === 'KEEP_ENVIRONMENT') {
			conflictResolutions[path] = 'target';
			keepEnvironmentPaths.push(path);
		}
	}

	return { conflictResolutions, keepCanonicalPaths, keepEnvironmentPaths };
}
