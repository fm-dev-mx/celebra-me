import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createBackupRunEvidence,
	observeBackupHealth,
	resolveBackupHealthNotification,
	writeAtomicJson,
} from '../../scripts/db/backup-health-evidence';

const runId = '018f7b77-80f8-7bd1-8f87-70d0b5312e2f';
const startedAt = '2026-08-31T03:00:00.000Z';
const endedAt = '2026-08-31T03:05:00.000Z';

function successfulReceipt() {
	return createBackupRunEvidence({
		runId,
		report: {
			startedAt,
			endedAt,
			outcome: 'succeeded',
			recoveryPointTimestamp: '2026-08-31T03:04:30.000Z',
			manifestVerified: true,
		},
		exitCode: 0,
		orphanCount: 0,
		observedAt: endedAt,
	});
}

describe('backup operational evidence', () => {
	it('writes a failure receipt atomically without leaving a temporary file', () => {
		const root = mkdtempSync(join(tmpdir(), 'backup-receipt-'));
		const path = join(root, 'backup-health-v1.json');
		const receipt = createBackupRunEvidence({
			runId,
			report: {
				startedAt,
				endedAt,
				outcome: 'failed',
				recoveryPointTimestamp: null,
				manifestVerified: false,
			},
			exitCode: 1,
			orphanCount: null,
			observedAt: endedAt,
		});
		try {
			writeAtomicJson(path, receipt);
			const stored = JSON.parse(readFileSync(path, 'utf8')) as typeof receipt;
			expect(stored.status).toBe('FAILED');
			expect(stored.payload.recovery_point_at).toBeNull();
			expect(readdirSync(root)).toEqual(['backup-health-v1.json']);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('classifies fresh, stale-report, expired-RPO, and unavailable evidence', () => {
		const receipt = successfulReceipt();
		const observation = {
			newestCreatedAt: '2026-08-31T03:04:30.000Z',
			lastDailyReportAt: endedAt,
			lastDailyOutcome: 'succeeded' as const,
			orphanCount: 0,
			manifestValid: true,
		};

		expect(
			observeBackupHealth({
				receipt,
				observation,
				observedAt: '2026-08-31T05:15:00.000Z',
			}).status,
		).toBe('VERIFIED');
		expect(
			observeBackupHealth({
				receipt,
				observation: {
					...observation,
					newestCreatedAt: '2026-09-01T04:00:00.000Z',
				},
				observedAt: '2026-09-01T05:15:00.000Z',
			}).status,
		).toBe('WARNING');
		expect(
			observeBackupHealth({
				receipt,
				observation,
				observedAt: '2026-09-01T05:15:00.000Z',
			}).reasonCode,
		).toBe('backup_rpo_expired');
		expect(
			observeBackupHealth({
				receipt,
				observation: null,
				observedAt: '2026-08-31T05:15:00.000Z',
			}).status,
		).toBe('UNVERIFIED');
	});

	it('deduplicates repeated problem alerts and emits recovery once', () => {
		expect(resolveBackupHealthNotification(null, 'FAILED')).toBe('problem');
		expect(resolveBackupHealthNotification('FAILED', 'FAILED')).toBe('none');
		expect(resolveBackupHealthNotification('WARNING', 'FAILED')).toBe('problem');
		expect(resolveBackupHealthNotification('FAILED', 'VERIFIED')).toBe('recovery');
		expect(resolveBackupHealthNotification('VERIFIED', 'VERIFIED')).toBe('none');
	});
});
