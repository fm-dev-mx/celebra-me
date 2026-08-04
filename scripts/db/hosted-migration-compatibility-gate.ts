/**
 * Shared hosted migration compatibility gate.
 * Thin wrapper over migrate-compatibility.ts for existing callers/tests.
 */

import {
	assertHostedCompatibilityOrFail,
	evaluateHostedCompatibilityForPlan,
	logHostedCompatibility,
} from './migrate-compatibility.ts';
import type { DbMigrateTarget } from './migration-deployment-compatibility.ts';

export function runHostedMigrationCompatibilityGate(options: {
	target: DbMigrateTarget;
	candidateVersions: readonly string[];
	dbAppliedVersions: readonly string[];
	fail: (message: string) => never;
	env?: NodeJS.ProcessEnv;
	/** When set (Production migrate), overrides CELEBRA_TARGET_RELEASE_SHA. */
	targetReleaseShaOverride?: string | null;
}): void {
	const result = evaluateHostedCompatibilityForPlan({
		target: options.target,
		candidateVersions: options.candidateVersions,
		dbAppliedVersions: options.dbAppliedVersions,
		env: options.env,
		targetReleaseShaOverride: options.targetReleaseShaOverride,
	});
	assertHostedCompatibilityOrFail(result, options.fail);
	logHostedCompatibility(result);
}
