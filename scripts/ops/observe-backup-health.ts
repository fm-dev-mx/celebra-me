import {
	BACKUP_HEALTH_ALERT_STATE_PATH,
	BACKUP_HEALTH_RECEIPT_PATH,
	observeBackupHealth,
	readBackupHealthObservation,
	readJsonIfPresent,
	resolveBackupHealthNotification,
	writeAtomicJson,
} from '../db/backup-health-evidence.ts';
import { serializeOperationalEvidenceEvent } from '../../src/lib/operations/operational-evidence.ts';

interface AlertStateV1 {
	version: 1;
	status: 'VERIFIED' | 'WARNING' | 'FAILED' | 'UNVERIFIED';
	observedAt: string;
}

function readPreviousStatus(value: unknown): AlertStateV1['status'] | null {
	if (!value || typeof value !== 'object') return null;
	const status = (value as { status?: unknown }).status;
	return status === 'VERIFIED' ||
		status === 'WARNING' ||
		status === 'FAILED' ||
		status === 'UNVERIFIED'
		? status
		: null;
}

const receipt = readJsonIfPresent(BACKUP_HEALTH_RECEIPT_PATH);
const evidence = observeBackupHealth({
	receipt,
	observation: readBackupHealthObservation(),
});
const previousStatus = readPreviousStatus(readJsonIfPresent(BACKUP_HEALTH_ALERT_STATE_PATH));
const notification = resolveBackupHealthNotification(previousStatus, evidence.status);

writeAtomicJson(BACKUP_HEALTH_ALERT_STATE_PATH, {
	version: 1,
	status: evidence.status,
	observedAt: evidence.observedAt,
} satisfies AlertStateV1);

console.info(serializeOperationalEvidenceEvent('critical_backup_summary', 'completed', evidence));
console.info(`BACKUP_HEALTH_NOTIFICATION=${notification}`);
console.info(`BACKUP_HEALTH_STATUS=${evidence.status}`);
console.info(`BACKUP_HEALTH_OWNER_ACTION=${evidence.ownerAction}`);

if (notification === 'problem') process.exitCode = 1;
