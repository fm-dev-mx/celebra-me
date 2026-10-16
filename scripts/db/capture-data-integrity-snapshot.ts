import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	buildDataIntegritySnapshotSql,
	compareDataIntegritySnapshots,
	formatDataIntegrityComparison,
	parseDataIntegritySnapshot,
	parseSnapshotArgs,
	snapshotFromPayload,
	type IntegritySnapshotTarget,
} from './data-integrity-snapshot.ts';
import { LOCAL_DB_URL, redactDbUrl } from './db-target-config.ts';
import {
	assertProductionDbUrl,
	getProdDbUrl,
	requirePreviewDbUrl,
	runCommand,
} from './db-workflow-lib.ts';
import { parsePsqlJsonPayload, wrapRecoveryIntegrityPsqlInput } from './recovery-integrity.ts';

function resolveTargetUrl(target: IntegritySnapshotTarget): string {
	if (target === 'local') return LOCAL_DB_URL;
	if (target === 'preview') return requirePreviewDbUrl().url;
	const { url } = getProdDbUrl();
	assertProductionDbUrl(url);
	return url;
}

/** psql writes to a file: per-row hashes exceed spawnSync's 1 MiB stdout buffer. */
function queryReadOnlyJson(dbUrl: string, sql: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-integrity-'));
	const outputPath = join(dir, 'snapshot.json');
	try {
		const result = runCommand(
			'psql',
			[
				'--set',
				'ON_ERROR_STOP=1',
				'--no-psqlrc',
				'--quiet',
				'--tuples-only',
				'--no-align',
				'--output',
				outputPath,
				'--dbname',
				dbUrl,
			],
			{ input: wrapRecoveryIntegrityPsqlInput(sql), redact: [dbUrl], throwOnError: false },
		);
		if (result.status !== 0)
			throw new Error(
				`Integrity snapshot query failed with process status ${String(result.status)}. ${result.stderr.trim()}`,
			);
		return readFileSync(outputPath, 'utf8');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function writeNewFile(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, '\t')}\n`, { flag: 'wx', mode: 0o600 });
}

function main(): void {
	const args = parseSnapshotArgs(process.argv.slice(2));
	const before = args.compare
		? parseDataIntegritySnapshot(readFileSync(resolve(args.compare), 'utf8'), args.compare)
		: undefined;

	let after;
	if (args.after) {
		after = parseDataIntegritySnapshot(readFileSync(resolve(args.after), 'utf8'), args.after);
	} else {
		const target = args.target!;
		const outPath = resolve(args.out!);
		if (before && before.target !== target)
			throw new Error(`--compare snapshot is from ${before.target}, not ${target}.`);
		const dbUrl = resolveTargetUrl(target);
		console.info(`Data integrity snapshot (read-only) of ${target}: ${redactDbUrl(dbUrl)}`);
		const payload = parsePsqlJsonPayload<Parameters<typeof snapshotFromPayload>[0]>(
			queryReadOnlyJson(dbUrl, buildDataIntegritySnapshotSql()),
			'data integrity snapshot',
		);
		after = snapshotFromPayload(payload, target);
		writeNewFile(outPath, after);
		const rows = Object.values(after.tables).reduce((sum, t) => sum + t.rowCount, 0);
		console.info(
			`Wrote ${outPath}: ${Object.keys(after.tables).length} tables, ${rows} rows, ${Object.keys(after.events).length} events, latest migration ${after.latestMigration ?? 'none'}.`,
		);
	}
	if (!before) return;

	const comparison = compareDataIntegritySnapshots(before, after);
	const reportPath = resolve(
		args.report ?? `${(args.out ?? args.after!).replace(/\.json$/i, '')}.compare.json`,
	);
	writeNewFile(reportPath, {
		before: { capturedAt: before.capturedAt, target: before.target },
		after: { capturedAt: after.capturedAt, target: after.target },
		...comparison,
	});
	console.info(`Compared with ${args.compare} (captured ${before.capturedAt}).`);
	for (const line of formatDataIntegrityComparison(comparison)) console.info(line);
	console.info(`Full report: ${reportPath}`);
	if (!comparison.ok) process.exitCode = 1;
}

try {
	main();
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
