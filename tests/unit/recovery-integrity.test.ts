import {
	compareRecoveryIntegrity,
	type RecoveryIntegritySnapshot,
} from '../../scripts/db/recovery-integrity';

function snapshot(): RecoveryIntegritySnapshot {
	return {
		version: 1,
		profile: 'phase3',
		capturedAt: '2026-07-29T12:00:00.000Z',
		migrationCount: 67,
		migrationVersions: ['20260729152113'],
		migrationSha256: 'a'.repeat(64),
		tables: {
			'public.guest_invitations': { rowCount: 3, sha256: 'b'.repeat(64) },
		},
		businessStateSha256: 'c'.repeat(64),
		invariants: { orphanGuests: 0 },
	};
}

describe('recovery integrity comparison', () => {
	it('accepts exact recovery evidence', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		expect(compareRecoveryIntegrity(expected, actual)).toEqual({ ok: true, failures: [] });
	});

	it('reports count, checksum, business-state, and invariant failures', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		actual.migrationCount = 66;
		actual.tables['public.guest_invitations'] = {
			rowCount: 2,
			sha256: 'd'.repeat(64),
		};
		actual.businessStateSha256 = 'e'.repeat(64);
		actual.invariants.orphanGuests = 1;
		const result = compareRecoveryIntegrity(expected, actual);
		expect(result.ok).toBe(false);
		expect(result.failures.join('\n')).toMatch(/Migration count mismatch/);
		expect(result.failures.join('\n')).toMatch(/row-count mismatch/);
		expect(result.failures.join('\n')).toMatch(/checksum mismatch/);
		expect(result.failures.join('\n')).toMatch(/business-state checksum mismatch/);
		expect(result.failures.join('\n')).toMatch(/Invariant orphanGuests/);
	});

	it('can compare two capture points without treating a stable pre-existing invariant as drift', () => {
		const expected = snapshot();
		expected.invariants.orphanGuests = 1;
		const actual = structuredClone(expected);
		expect(
			compareRecoveryIntegrity(expected, actual, { requireValidInvariants: false }),
		).toEqual({ ok: true, failures: [] });
	});

	it('rejects a recovery snapshot captured under a different schema profile', () => {
		const expected = snapshot();
		const actual = structuredClone(expected);
		actual.profile = 'pre-phase3';
		expect(compareRecoveryIntegrity(expected, actual).failures).toEqual([
			'Recovery integrity profile mismatch: expected phase3, got pre-phase3.',
		]);
	});
});
