import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateCriticalBackupHealth } from '../../scripts/db/critical-backup-health';

describe('critical backup health', () => {
	it('flags a missing or stale daily report without treating a fresh standalone set as daily evidence', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-health-'));
		const complete = join(root, 'critical-2026-08-15T22-08-28-817Z');
		mkdirSync(complete, { recursive: true });
		writeFileSync(
			join(complete, 'manifest.json'),
			JSON.stringify({ createdAt: '2026-08-15T22:13:29.379Z' }),
		);
		mkdirSync(join(root, 'reports'), { recursive: true });
		writeFileSync(
			join(root, 'reports', 'daily-backup-2026-08-04T04-07-35-575Z.json'),
			JSON.stringify({
				endedAt: '2026-08-04T04:09:01.176Z',
				outcome: 'succeeded',
			}),
		);
		try {
			const health = evaluateCriticalBackupHealth({
				backupRoot: root,
				nowMs: Date.parse('2026-08-15T22:30:00.000Z'),
			});
			expect(health.attention).toBe(true);
			expect(health.lastDailyOutcome).toBe('succeeded');
			expect(health.newestCreatedAt).toBe('2026-08-15T22:13:29.379Z');
			expect(health.summary).toMatch(/daily 11d/);
			expect(health.summary).toMatch(/último set 0h/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('counts manifest-less critical directories as orphans', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-health-orphan-'));
		const orphan = join(root, 'critical-2026-08-15T21-48-06-699Z');
		mkdirSync(orphan, { recursive: true });
		try {
			const health = evaluateCriticalBackupHealth({
				backupRoot: root,
				nowMs: Date.parse('2026-08-15T22:30:00.000Z'),
			});
			expect(health.orphanCount).toBe(1);
			expect(health.attention).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
