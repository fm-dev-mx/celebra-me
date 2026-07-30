import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	validateCriticalBackupManifest,
	type CriticalBackupKind,
	type CriticalBackupManifest,
} from './backup-manifest.ts';
import { runCommand, timestamp } from './db-workflow-lib.ts';
import {
	applyCriticalBackupRetention,
	assertWindowsEfsEncrypted,
	listCriticalBackups,
	planCriticalBackupRetention,
	prepareEncryptedLocalDirectory,
} from './local-backup-operations.ts';

interface DailyBackupReport {
	version: 1;
	startedAt: string;
	endedAt: string;
	outcome: 'succeeded' | 'failed';
	recoveryPointTimestamp: string | null;
	durationMs: number;
	bytesDownloaded: Record<CriticalBackupKind | 'total', number> | null;
	totalBackupSizeBytes: number | null;
	estimatedMonthlyEgressBytes: number | null;
	manifestVerified: boolean;
	retainedBackupPath: string | null;
	retention: { daily: number; monthly: number; removed: number } | null;
	failureCode: 'critical_backup_failed' | null;
	integrityProfile: 'phase3';
}

const backupRoot = resolve('.backups', 'prod');
const reportRoot = resolve(backupRoot, 'reports');
const startedAt = new Date();
const reportPath = resolve(reportRoot, `daily-backup-${timestamp()}.json`);
const dailyRetention = 30;
const monthlyRetention = 12;
// Production completed Phase 3; backups always capture the standard phase3 integrity profile.
// Restore-side tooling still reads the profile stored in each retained backup manifest.
const integrityProfile = 'phase3' as const;

function directorySize(path: string): number {
	return statSync(path).isFile()
		? statSync(path).size
		: listFiles(path).reduce((total, file) => total + statSync(file).size, 0);
}

function listFiles(path: string): string[] {
	const entries = readdirSync(path, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const child = resolve(path, entry.name);
		return entry.isDirectory() ? listFiles(child) : [child];
	});
}

function writeReport(report: DailyBackupReport): void {
	mkdirSync(dirname(reportPath), { recursive: true });
	prepareEncryptedLocalDirectory(reportRoot);
	writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
	assertWindowsEfsEncrypted([reportPath]);
	console.info(`Daily backup report: ${reportPath}`);
}

let report: DailyBackupReport = {
	version: 1,
	startedAt: startedAt.toISOString(),
	endedAt: startedAt.toISOString(),
	outcome: 'failed',
	recoveryPointTimestamp: null,
	durationMs: 0,
	bytesDownloaded: null,
	totalBackupSizeBytes: null,
	estimatedMonthlyEgressBytes: null,
	manifestVerified: false,
	retainedBackupPath: null,
	retention: null,
	failureCode: 'critical_backup_failed',
	integrityProfile,
};

try {
	mkdirSync(backupRoot, { recursive: true });
	prepareEncryptedLocalDirectory(backupRoot);
	const backupArgs = ['tsx', 'scripts/db/backup-critical-production.ts'];
	const result = runCommand('npx', backupArgs, { throwOnError: false });
	if (result.status !== 0) throw new Error('Critical backup failed.');
	const marker = result.stdout
		.split(/\r?\n/)
		.find((line) => line.startsWith('CRITICAL_BACKUP_MANIFEST='));
	if (!marker) throw new Error('Critical backup did not return a manifest path.');
	const manifestPath = resolve(marker.slice('CRITICAL_BACKUP_MANIFEST='.length));
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
	validateCriticalBackupManifest(manifest);
	assertWindowsEfsEncrypted([
		manifestPath,
		...manifest.artifacts.map((artifact) => artifact.path),
	]);

	const byKind = new Map(manifest.artifacts.map((artifact) => [artifact.kind, artifact.bytes]));
	const totalDownloaded = manifest.artifacts.reduce(
		(total, artifact) => total + artifact.bytes,
		0,
	);
	const retentionPlan = planCriticalBackupRetention(
		listCriticalBackups(backupRoot),
		dailyRetention,
		monthlyRetention,
	);
	applyCriticalBackupRetention(backupRoot, retentionPlan);
	const endedAt = new Date();
	report = {
		version: 1,
		startedAt: startedAt.toISOString(),
		endedAt: endedAt.toISOString(),
		outcome: 'succeeded',
		recoveryPointTimestamp: manifest.createdAt,
		durationMs: endedAt.getTime() - startedAt.getTime(),
		bytesDownloaded: {
			database: byKind.get('database') ?? 0,
			auth: byKind.get('auth') ?? 0,
			'storage-metadata': byKind.get('storage-metadata') ?? 0,
			'storage-objects': byKind.get('storage-objects') ?? 0,
			total: totalDownloaded,
		},
		totalBackupSizeBytes: directorySize(dirname(manifestPath)),
		estimatedMonthlyEgressBytes: totalDownloaded * 30,
		manifestVerified: true,
		retainedBackupPath: dirname(manifestPath),
		retention: {
			daily: dailyRetention,
			monthly: monthlyRetention,
			removed: retentionPlan.remove.length,
		},
		failureCode: null,
		integrityProfile,
	};
} catch {
	const endedAt = new Date();
	report.endedAt = endedAt.toISOString();
	report.durationMs = endedAt.getTime() - startedAt.getTime();
	writeReport(report);
	process.exit(1);
}

writeReport(report);
