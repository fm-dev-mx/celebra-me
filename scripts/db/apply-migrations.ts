/**
 * apply-migrations.ts — Apply all repository migrations to a target DB
 *
 * Used by the disposable test environment to apply migrations cleanly.
 * Uses --single-transaction so that migrations containing temp tables with
 * `ON COMMIT DROP` (like 20260608000001_correct_icon_migration_preflight.sql)
 * work correctly when applied via `psql --file`.
 *
 * Usage:
 *   tsx scripts/db/apply-migrations.ts --db-url <connection-string>
 *   tsx scripts/db/apply-migrations.ts --db-url <url> --file <single-migration.sql>
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');

function runPsqlFileSingleTxn(dbUrl: string, filePath: string): { ok: boolean; output: string } {
	const result = spawnSync(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--single-transaction',
			'--no-psqlrc',
			'--dbname',
			dbUrl,
			'--file',
			filePath,
		],
		{ encoding: 'utf8', stdio: 'pipe' },
	);
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';
	return {
		ok: result.status === 0,
		output: stdout + stderr,
	};
}

function main(): void {
	const args = process.argv.slice(2);
	const dbUrlIdx = args.indexOf('--db-url');
	const fileIdx = args.indexOf('--file');

	if (dbUrlIdx === -1) {
		console.error('Usage: tsx scripts/db/apply-migrations.ts --db-url <url> [--file <path>]');
		process.exit(1);
	}

	const dbUrl = args[dbUrlIdx + 1];
	if (!dbUrl) {
		console.error('Missing --db-url value');
		process.exit(1);
	}

	// Single-file mode
	if (fileIdx !== -1) {
		const filePath = resolve(PROJECT_ROOT, args[fileIdx + 1]);
		if (!existsSync(filePath)) {
			console.error(`File not found: ${filePath}`);
			process.exit(1);
		}
		const result = runPsqlFileSingleTxn(dbUrl, filePath);
		if (!result.ok) {
			console.error(`FAILED: ${filePath}`);
			console.error(result.output);
			process.exit(1);
		}
		console.info(`OK: ${filePath}`);
		return;
	}

	// All-migrations mode
	if (!existsSync(MIGRATIONS_DIR)) {
		console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
		process.exit(1);
	}

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	console.info(
		`Applying ${files.length} migrations from ${MIGRATIONS_DIR} to ${dbUrl.replace(/:[^:@/]*@/, ':***@')}`,
	);

	let applied = 0;
	let failed = 0;
	for (const file of files) {
		const filePath = resolve(MIGRATIONS_DIR, file);
		process.stdout.write(`  ${file}: `);
		const result = runPsqlFileSingleTxn(dbUrl, filePath);
		if (result.ok) {
			console.info('OK');
			applied++;
		} else {
			console.info('FAIL');
			// Extract just the last error line for brevity
			const errorLine =
				result.output
					.split('\n')
					.filter((l) => l.includes('ERROR'))
					.pop() ?? result.output;
			console.error(`    ${errorLine.trim()}`);
			failed++;
			console.error('Migration application stopped at the first failure.');
			break;
		}
	}

	console.info(`\nResult: ${applied}/${files.length} applied, ${failed} failed`);
	process.exit(failed > 0 ? 1 : 0);
}

main();
