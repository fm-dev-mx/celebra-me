import { resolve } from 'node:path';
import {
	assertProductionDbUrl,
	createProdBackup,
	getProdDbUrl,
	log,
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

log('Production backup');
log(`- PROD_DB_URL source: ${source}`);
log(`- Target: ${redactDbUrl(prodDbUrl)}`);
log('- Mode: read-only dump; production will not be mutated');
log('- Warning: backups contain real customer data and must never be committed');

createProdBackup(prodDbUrl, backupPath, schemaOnly);

log('Backup complete');
log(`- File: ${backupPath}`);
log('- Keep this file in gitignored storage only');
