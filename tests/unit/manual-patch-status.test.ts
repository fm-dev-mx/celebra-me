import { describe, expect, it, jest } from '@jest/globals';
import {
	ACTIVE_MANUAL_PATCH_CATALOG,
	classifyPatchPreviewResult,
	readManualPatchStatuses,
	validateManualPatchCatalog,
} from '../../scripts/provision/manual-patch-status';

describe('active manual patch status', () => {
	it('contains only the two approved production detectors and valid manifests', () => {
		expect(ACTIVE_MANUAL_PATCH_CATALOG).toHaveLength(2);
		expect(new Set(ACTIVE_MANUAL_PATCH_CATALOG.map((item) => item.scriptId)).size).toBe(2);
		expect(ACTIVE_MANUAL_PATCH_CATALOG.every((item) => item.targetEnvironments.join(',') === 'production')).toBe(true);
		expect(validateManualPatchCatalog()).toEqual({ valid: true, errors: [] });
	});

	it.each([
		[{ status: 0, stdout: '0\n' }, 'NOT_NEEDED', 'LIVE_ZERO_ROWS'],
		[{ status: 0, stdout: '4\n' }, 'PENDING', 'LIVE_ROWS_WITHIN_RANGE'],
		[{ status: 0, stdout: '9\n' }, 'BLOCKED', 'LIVE_ROWS_OUTSIDE_RANGE'],
		[{ status: 1, stdout: '', stderr: 'connection refused' }, 'UNVERIFIED', 'QUERY_FAILED'],
		[{ status: 1, stdout: '', stderr: 'STATUS_PROBE_TIMEOUT' }, 'UNVERIFIED', 'QUERY_TIMEOUT'],
		[{ status: 0, stdout: '4\n5\n' }, 'UNVERIFIED', 'QUERY_INVALID_OUTPUT'],
	] as const)('classifies %s safely', (result, status, reason) => {
		const classified = classifyPatchPreviewResult({ result, min: 4, max: 8 });
		expect(classified.status).toBe(status);
		expect(classified.reason).toBe(reason);
		 expect(classified.planCommand).toBe(status === 'PENDING' ? 'pnpm prod:apply -- --patch <file> --owner-user-id <uuid>' : null);
	});

	it('isolates an invalid catalog entry as BLOCKED without probing', async () => {
		const psql = jest.fn();
		const statuses = await readManualPatchStatuses({
			catalog: [{
				scriptId: 'invalid-entry',
				file: 'scripts/manual/production-patches/not-approved.sql',
				purpose: 'invalid',
				targetEnvironments: ['production'],
				expectedRowsMin: 1,
				expectedRowsMax: 2,
			}],
			session: { psql } as never,
		});
		expect(statuses[0]?.environments.production.status).toBe('BLOCKED');
		expect(statuses[0]?.environments.production.reason).toBe('CATALOG_INVALID');
		expect(psql).not.toHaveBeenCalled();
	});
});
