import { describe, expect, it } from '@jest/globals';
import { classifyInvitationInventory } from '../../scripts/provision/invitation-status-classification.ts';

describe('read-only invitation inventory classification', () => {
	it('never promotes unmanaged inventory into a managed update candidate', () => {
		const result = classifyInvitationInventory(['managed'], [{ slug: 'managed', hasProvenance: true }, { slug: 'legacy' }, { slug: 'demo', kind: 'demo' }]);
		expect(Object.fromEntries(result)).toEqual({ managed: 'MANAGED', legacy: 'LEGACY_REVIEW_REQUIRED', demo: 'DEMO' });
	});
});
