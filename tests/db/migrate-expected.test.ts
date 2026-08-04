import { describe, expect, it } from '@jest/globals';
import { parseExpectedConstraint } from '../../scripts/db/migrate-expected.ts';

describe('parseExpectedConstraint', () => {
	it('parses canonical --expected', () => {
		const result = parseExpectedConstraint(['--expected', '20260730220544,20260802090000'], {});
		expect(result.expectedPin).toEqual(['20260730220544', '20260802090000']);
		expect(result.deprecationWarnings).toEqual([]);
	});

	it('warns and delegates deprecated --allowlist when Preview aliases are enabled', () => {
		const result = parseExpectedConstraint(['--allowlist', '20260802090000'], {}, {
			allowDeprecatedAliases: true,
		});
		expect(result.expectedPin).toEqual(['20260802090000']);
		expect(result.deprecationWarnings.join(' ')).toMatch(/DEPRECATED: --allowlist/);
	});

	it('warns and delegates EXPECTED_MIGRATIONS when Preview aliases are enabled', () => {
		const result = parseExpectedConstraint(
			[],
			{ EXPECTED_MIGRATIONS: '20260802090000' },
			{ allowDeprecatedAliases: true },
		);
		expect(result.expectedPin).toEqual(['20260802090000']);
		expect(result.deprecationWarnings.join(' ')).toMatch(/DEPRECATED: EXPECTED_MIGRATIONS/);
	});

	it('rejects --allowlist when deprecated aliases are disabled (Production/Local)', () => {
		expect(() => parseExpectedConstraint(['--allowlist', '20260802090000'], {})).toThrow(
			/--allowlist/,
		);
	});

	it('rejects EXPECTED_MIGRATIONS when deprecated aliases are disabled', () => {
		expect(() =>
			parseExpectedConstraint([], { EXPECTED_MIGRATIONS: '20260802090000' }),
		).toThrow(/EXPECTED_MIGRATIONS/);
	});

	it('rejects conflicting --expected and --allowlist values when aliases are enabled', () => {
		expect(() =>
			parseExpectedConstraint(
				['--expected', '20260802090000', '--allowlist', '20260730220544'],
				{},
				{ allowDeprecatedAliases: true },
			),
		).toThrow(/Conflicting/);
	});

	it('returns null pin when unconstrained', () => {
		expect(parseExpectedConstraint([], {}).expectedPin).toBeNull();
	});
});
