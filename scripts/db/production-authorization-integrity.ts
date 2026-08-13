/**
 * Compare live Production migration history with durable owner-apply evidence.
 * Schema parity is not authorization evidence.
 */

import type { AuthorizationIntegrity } from '../../src/lib/status/types.ts';
import {
	OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH,
	listOwnerApplyRecords,
	recordedMigrationVersions,
	type OwnerApplyRecord,
} from './owner-apply-record.ts';

export interface ProductionAuthorizationIntegrity {
	status: AuthorizationIntegrity;
	grandfatheredThrough: string;
	missingVersions: string[];
	recordedVersions: string[];
	appliedPostGrandfather: string[];
}

export function evaluateProductionAuthorizationIntegrity(input: {
	environment: 'local' | 'preview' | 'production';
	evidence: 'LIVE' | 'CACHED' | 'UNVERIFIED';
	appliedVersions: readonly string[] | null;
	records?: readonly OwnerApplyRecord[];
	ledgerDir?: string;
	cwd?: string;
	grandfatheredThrough?: string;
}): ProductionAuthorizationIntegrity {
	const grandfatheredThrough =
		input.grandfatheredThrough ?? OWNER_APPLY_LEDGER_GRANDFATHER_THROUGH;
	if (input.environment !== 'production') {
		return {
			status: 'NOT_APPLICABLE',
			grandfatheredThrough,
			missingVersions: [],
			recordedVersions: [],
			appliedPostGrandfather: [],
		};
	}
	if (input.evidence === 'UNVERIFIED' || input.appliedVersions == null) {
		return {
			status: 'UNVERIFIED',
			grandfatheredThrough,
			missingVersions: [],
			recordedVersions: [],
			appliedPostGrandfather: [],
		};
	}

	const records =
		input.records ?? listOwnerApplyRecords({ ledgerDir: input.ledgerDir, cwd: input.cwd });
	const recorded = recordedMigrationVersions(records);
	const appliedPostGrandfather = input.appliedVersions.filter(
		(version) => version > grandfatheredThrough,
	);
	const missingVersions = appliedPostGrandfather.filter((version) => !recorded.has(version));
	const recordedVersions = appliedPostGrandfather.filter((version) => recorded.has(version));

	let status: AuthorizationIntegrity = 'GRANDFATHERED';
	if (missingVersions.length > 0) status = 'MISSING';
	else if (appliedPostGrandfather.length > 0) status = 'RECORDED';

	return {
		status,
		grandfatheredThrough,
		missingVersions,
		recordedVersions,
		appliedPostGrandfather,
	};
}
