/**
 * preview-sync-report.ts — Sync Report Generation
 *
 * Produces machine-readable JSON and human-readable console reports
 * for the Production-to-Preview sync operation.
 */

import { resolve } from 'node:path';
import { ensureDir, writeTextFile, PROJECT_ROOT } from './db-workflow-lib.ts';

export interface SyncReport {
	dryRun: boolean;
	startedAt: string;
	source: string;
	target: string;
	created: Record<string, number>;
	copiedAssets: number;
	missingAssets: string[];
	detectedDrift: string[];
	excludedTableCounts: Record<string, number>;
	failures: string[];
	status: 'dry-run-pending' | 'applied' | 'failed';
}

export function createReport(dryRun: boolean): SyncReport {
	return {
		dryRun,
		startedAt: new Date().toISOString(),
		source: '',
		target: '',
		created: {},
		copiedAssets: 0,
		missingAssets: [],
		detectedDrift: [],
		excludedTableCounts: {},
		failures: [],
		status: 'dry-run-pending' as const,
	};
}

export function printReport(report: SyncReport, redactDbUrl: (url: string) => string): void {
	console.info('\n' + '='.repeat(60));
	console.info('SYNC REPORT');
	console.info('='.repeat(60));
	console.info(`Status:     ${report.status}`);
	console.info(`Dry run:    ${report.dryRun ? 'YES' : 'NO'}`);
	console.info(`Started:    ${report.startedAt}`);
	console.info(`Source:     ${redactDbUrl(report.source)}`);
	console.info(`Target:     ${redactDbUrl(report.target)}`);
	console.info('');

	if (report.failures.length > 0) {
		console.info('❌ FAILURES:');
		for (const f of report.failures) {
			console.info(`   - ${f}`);
		}
		console.info('');
	}

	if (report.missingAssets.length > 0) {
		console.info('⚠️  MISSING ASSETS:');
		for (const a of report.missingAssets) {
			console.info(`   - ${a}`);
		}
		console.info('');
	}

	console.info('Records:');
	for (const [table, count] of Object.entries(report.created)) {
		if (count > 0) {
			console.info(`   ${table}: ${count}`);
		}
	}

	console.info('');
	console.info('Storage:');
	console.info(`   Assets copied: ${report.copiedAssets}`);
	console.info(`   Assets missing: ${report.missingAssets.length}`);

	console.info('');
	console.info('Excluded data (not copied):');
	for (const [table, count] of Object.entries(report.excludedTableCounts)) {
		console.info(`   ${table}: ${count} rows on source`);
	}

	if (report.detectedDrift.length > 0) {
		console.info('');
		console.info('⚠️  DRIFT DETECTED:');
		for (const d of report.detectedDrift) {
			console.info(`   - ${d}`);
		}
	}

	if (report.dryRun) {
		console.info('\nℹ️  This was a DRY RUN. No data was modified.');
		console.info('   Run with --apply to execute.');
	}

	console.info('='.repeat(60) + '\n');
}

export function writeReportFile(report: SyncReport, redactDbUrl: (url: string) => string): void {
	const reportDir = resolve(PROJECT_ROOT, '.tmp', 'reports');
	ensureDir(reportDir);
	const filename = `preview-sync-${report.startedAt.replace(/[:.]/g, '-')}.json`;
	const filePath = resolve(reportDir, filename);
	const safeReport = {
		...report,
		source: redactDbUrl(report.source),
		target: redactDbUrl(report.target),
	};
	writeTextFile(filePath, JSON.stringify(safeReport, null, 2));
	console.info(`Report written to: ${filePath}`);
}
