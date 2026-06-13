import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintProductionPatchSql, argValue } from './sql-safety.ts';

const dryRun = process.argv.includes('--dry-run');
const file = argValue('--file');

if (!dryRun) {
	console.error(
		'Production patch execution is not implemented. This entrypoint is dry-run only.',
	);
	process.exit(1);
}

if (!file || file === '--help' || file === '-h') {
	console.error('Usage: pnpm db:prod:patch -- --file <production-patch.sql>');
	process.exit(1);
}

const path = resolve(process.cwd(), file);
const sql = readFileSync(path, 'utf8');
const result = lintProductionPatchSql(sql);

if (!result.ok) {
	console.error(`Production patch dry-run blocked: ${path}`);
	for (const error of result.errors) console.error(`- ${error}`);
	process.exit(1);
}

console.info(`Production patch dry-run passed lint only: ${path}`);
console.info('No database connection was opened and no SQL was executed.');
