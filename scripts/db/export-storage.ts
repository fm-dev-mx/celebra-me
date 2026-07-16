/**
 * export-storage.ts — Export Storage buckets and objects for local clone
 *
 * Exports storage.buckets and storage.objects metadata only.
 * Does NOT export the actual binary files (which require separate download
 * from Supabase Storage API). The local restore will have correct paths
 * and metadata; binaries must be downloaded separately via the Storage API.
 *
 * Usage:
 *   PROD_DB_URL=... tsx scripts/db/export-storage.ts --out <path>
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertProductionDbUrl, getProdDbUrl, redactDbUrl } from './db-workflow-lib.ts';

const DEFAULT_OUT = resolve(process.cwd(), '.backups', 'prod', 'storage-metadata.sql');

function main(): void {
	const args = process.argv.slice(2);
	const outIdx = args.indexOf('--out');
	const outPath = outIdx !== -1 ? resolve(process.cwd(), args[outIdx + 1]) : DEFAULT_OUT;

	const { url: prodDbUrl, source } = getProdDbUrl();
	assertProductionDbUrl(prodDbUrl);

	console.info('Export Storage (buckets + objects metadata)');
	console.info(`  PROD_DB_URL source: ${source}`);
	console.info(`  Target: ${redactDbUrl(prodDbUrl)}`);
	console.info(`  Output: ${outPath}`);

	mkdirSync(dirname(outPath), { recursive: true });

	const result = spawnSync('pg_dump', [
		'--data-only',
		'--inserts',
		'--no-owner',
		'--no-privileges',
		'--table', 'storage.buckets',
		'--table', 'storage.objects',
		'--file', outPath,
		prodDbUrl,
	], { encoding: 'utf8', stdio: 'pipe' });

	if (result.status !== 0) {
		console.error(`pg_dump failed: ${result.stderr}`);
		process.exit(1);
	}

	console.info(`Storage export complete: ${outPath}`);
	console.info('Contains: storage.buckets, storage.objects (metadata)');
	console.info('Excludes: actual binary files (download separately via Storage API)');
}

main();
