import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintProductionPatchSql, argValue } from './sql-safety.ts';

const file = argValue('--file') ?? process.argv[2];
if (!file || file === '--help' || file === '-h') {
	console.error('Usage: pnpm db:sql:lint -- --file <production-patch.sql>');
	process.exit(1);
}

const path = resolve(process.cwd(), file);
const result = lintProductionPatchSql(readFileSync(path, 'utf8'));

if (!result.ok) {
	console.error(`SQL safety lint failed: ${path}`);
	for (const error of result.errors) console.error(`- ${error}`);
	process.exit(1);
}

console.info(`SQL safety lint passed: ${path}`);
