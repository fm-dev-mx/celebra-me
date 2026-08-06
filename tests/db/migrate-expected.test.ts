import { describe, expect, it } from '@jest/globals';
import { parseExpectedConstraint } from '../../scripts/db/migrate-expected.ts';

describe('parseExpectedConstraint', () => {
	it('parses canonical --expected', () => {
		const result = parseExpectedConstraint(['--expected', '20260730220544,20260802090000'], {});
		expect(result.expectedPin).toEqual(['20260730220544', '20260802090000']);
		expect(result.deprecationWarnings).toEqual([]);
	});

	it('rejects removed --allowlist', () => {
		expect(() => parseExpectedConstraint(['--allowlist', '20260802090000'], {})).toThrow(
			/--allowlist/,
		);
	});

	it('rejects removed EXPECTED_MIGRATIONS', () => {
		expect(() =>
			parseExpectedConstraint([], { EXPECTED_MIGRATIONS: '20260802090000' }),
		).toThrow(/EXPECTED_MIGRATIONS/);
	});

	it('returns null pin when unconstrained', () => {
		expect(parseExpectedConstraint([], {}).expectedPin).toBeNull();
	});
});
