import { describe, expect, it } from '@jest/globals';
import { formatCanonicalStatusView } from '../../scripts/provision/canonical-status-format.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';

describe('canonical status CLI format', () => {
	it('scopes CURRENT to schema and keeps disposable separate', () => {
		const text = formatCanonicalStatusView(buildCanonicalStatusViewFixture());
		expect(text).toContain('CURRENT 75/75');
		expect(text).toContain('Readiness');
		expect(text).toContain('NEEDS_DISPOSABLE_PROOF');
		expect(text).toContain('DISPOSABLE-TEST (not a persistent schema environment)');
		expect(text).toContain('Disposable proof: MISSING');
		expect(text).toContain('Does not mean Local, Preview, or Production schema is behind');
		expect(text).toContain('Active DB rows (not registry)');
		expect(text).not.toMatch(/\bManaged\b/);
		expect(text).not.toContain('PROMOTIONS');
		expect(text).toContain('OWNER / HITL REQUIRED');
		expect(text).toContain('Preview → Production');
		expect(text).toContain('PROMOTE_PRODUCTION');
	});
});
