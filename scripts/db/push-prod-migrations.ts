import { resolve } from 'node:path';
import {
	assertProductionDbUrl,
	createProdBackup,
	fail,
	getProdDbUrl,
	log,
	redactDbUrl,
	requireProductionConfirmation,
	runCommand,
	timestamp,
} from './db-workflow-lib.ts';

async function main(): Promise<void> {
	const { url: prodDbUrl, source } = getProdDbUrl();
	const target = assertProductionDbUrl(prodDbUrl);

	log('Production migration workflow');
	log(`- PROD_DB_URL source: ${source}`);
	log(`- Target: ${redactDbUrl(prodDbUrl)}`);
	log('- This is the only approved script in this repo that mutates production');
	log('- It applies reviewed migrations only; it never restores or pushes local data dumps');

	await requireProductionConfirmation(target.hostname);

	log('Running preflight checks');
	runCommand('pnpm', ['type-check']);
	runCommand('pnpm', ['test']);
	runCommand('pnpm', ['build']);
	runCommand('supabase', ['migration', 'list', '--db-url', prodDbUrl], { redact: [prodDbUrl] });

	const backupPath = resolve(
		process.cwd(),
		'.backups',
		'prod',
		`prod-public-data-before-migrations-${timestamp()}.sql`,
	);
	log(`Creating production backup before migrations: ${backupPath}`);
	createProdBackup(prodDbUrl, backupPath, false);

	log('Applying pending migrations to production');
	runCommand('supabase', ['db', 'push', '--db-url', prodDbUrl, '--yes'], { redact: [prodDbUrl] });

	log('Production migration complete');
	log(`- Backup for rollback/data inspection: ${backupPath}`);
	log(
		'- Rollback note: create a reviewed corrective migration; use the backup only as a protected reference',
	);
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
