import { describe, expect, it } from '@jest/globals';
import { buildReconciliationManagedApplyPlan } from '../../scripts/provision/reconciliation-persist.ts';

describe('Reconciliation managed persistence plan', () => {
	it('maps KEEP_CANONICAL to package resolutions for managed apply', () => {
		const plan = buildReconciliationManagedApplyPlan({
			'details.ceremony.address': 'KEEP_CANONICAL',
			'theme.primaryColor': 'KEEP_ENVIRONMENT',
			'details.notes': 'DEFER',
		});
		expect(plan.conflictResolutions['details.ceremony.address']).toBe('package');
		expect(plan.conflictResolutions['theme.primaryColor']).toBe('target');
		expect(plan.conflictResolutions['details.notes']).toBeUndefined();
		expect(plan.keepCanonicalPaths).toEqual(['details.ceremony.address']);
		expect(plan.keepEnvironmentPaths).toEqual(['theme.primaryColor']);
	});
});
