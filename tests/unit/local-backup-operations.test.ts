import {
	planCriticalBackupRetention,
	type RetentionCandidate,
} from '../../scripts/db/local-backup-operations';

function candidate(path: string, createdAt: string): RetentionCandidate {
	return { path, createdAt: new Date(createdAt) };
}

describe('local critical backup retention', () => {
	it('keeps the newest daily recovery points plus one point from each older month', () => {
		const candidates = [
			candidate('current-3', '2026-07-29T03:00:00Z'),
			candidate('current-2', '2026-07-28T03:00:00Z'),
			candidate('current-1', '2026-07-27T03:00:00Z'),
			candidate('june-new', '2026-06-30T03:00:00Z'),
			candidate('june-old', '2026-06-01T03:00:00Z'),
			candidate('may', '2026-05-31T03:00:00Z'),
			candidate('april', '2026-04-30T03:00:00Z'),
		];

		const plan = planCriticalBackupRetention(candidates, 3, 2);

		expect(plan.keep.map((entry) => entry.path)).toEqual([
			'current-3',
			'current-2',
			'current-1',
			'june-new',
			'may',
		]);
		expect(plan.remove.map((entry) => entry.path)).toEqual(['june-old', 'april']);
	});

	it('rejects invalid retention counts', () => {
		expect(() => planCriticalBackupRetention([], 0, 12)).toThrow(/positive integer/);
		expect(() => planCriticalBackupRetention([], 30, -1)).toThrow(/non-negative integer/);
	});
});
