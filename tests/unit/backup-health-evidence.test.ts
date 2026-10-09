import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackupRunEvidence, writeAtomicJson } from '../../scripts/db/backup-health-evidence';

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

	it('records a verified receipt for a completed backup', () => {
		const receipt = successfulReceipt();
		expect(receipt.status).toBe('VERIFIED');
		expect(receipt.reasonCode).toBe('backup_completed');
		expect(receipt.payload.manifest_valid).toBe(true);
	});
});
