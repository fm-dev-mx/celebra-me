import { describe, expect, it } from '@jest/globals';
import { parseExpectedConstraint } from '../../scripts/db/migrate-expected.ts';

describe('parseExpectedConstraint', () => {
	it('parses canonical --expected', () => {
		const result = parseExpectedConstraint(['--expected', '20260730220544,20260802090000'], {});
		expect(result.expectedPin).toEqual(['20260730220544', '20260802090000']);
		expect(result.deprecationWarnings).toEqual([]);
	});

	it('warns and delegates deprecated --allowlist to the shared parser', () => {
		const result = parseExpectedConstraint(['--allowlist', '20260802090000'], {});
		expect(result.expectedPin).toEqual(['20260802090000']);
		expect(result.deprecationWarnings.join(' ')).toMatch(/DEPRECATED: --allowlist/);
	});

	it('warns and delegates EXPECTED_MIGRATIONS to the shared parser', () => {
		const result = parseExpectedConstraint([], {
			EXPECTED_MIGRATIONS: '20260802090000',
		});
		expect(result.expectedPin).toEqual(['20260802090000']);
		expect(result.deprecationWarnings.join(' ')).toMatch(/DEPRECATED: EXPECTED_MIGRATIONS/);
	});

	it('rejects conflicting --expected and --allowlist values', () => {
		expect(() =>
			parseExpectedConstraint(
				['--expected', '20260802090000', '--allowlist', '20260730220544'],
				{},
			),
		).toThrow(/Conflicting/);
	});

	it('returns null pin when unconstrained', () => {
		expect(parseExpectedConstraint([], {}).expectedPin).toBeNull();
	});
});
