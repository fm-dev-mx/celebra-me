import { resolve } from 'node:path';
import {
	assertProductionDbUrl,
	createProdBackup,
	getProdDbUrl,
	redactDbUrl,
	timestamp,
} from './db-workflow-lib.ts';

const schemaOnly = process.argv.includes('--schema-only');
const { url: prodDbUrl, source } = getProdDbUrl();
assertProductionDbUrl(prodDbUrl);
const stamp = timestamp();
const backupPath = resolve(
	process.cwd(),
	'.backups',
	'prod',
	`prod-public-${schemaOnly ? 'schema' : 'data'}-${stamp}.sql`,
);

console.info('Production backup');
console.info(`- PROD_DB_URL source: ${source}`);
console.info(`- Target: ${redactDbUrl(prodDbUrl)}`);
console.info('- Mode: read-only dump; production will not be mutated');
console.info('- Warning: backups contain real customer data and must never be committed');

createProdBackup(prodDbUrl, backupPath, schemaOnly);

console.info('Backup complete');
console.info(`- File: ${backupPath}`);
console.info('- Keep this file in gitignored storage only');
