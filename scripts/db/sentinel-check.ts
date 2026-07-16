/**
 * sentinel-check.ts — Persistent Local Database Sentinel
 *
 * Verifies that a sentinel row exists in the persistent-local database.
 * This is used to prove that normal CI and database operations do not
 * reset or delete the persistent local database.
 *
 * The sentinel is a synthetic row in a dedicated `_db_sentinel` table
 * (or metadata key in an existing table) that should survive all normal
 * development workflows.
 *
 * Usage:
 *   tsx scripts/db/sentinel-check.ts insert   — Insert the sentinel row
 *   tsx scripts/db/sentinel-check.ts check    — Verify the sentinel exists (exit 1 if missing)
 *   tsx scripts/db/sentinel-check.ts remove   — Remove the sentinel (cleanup)
 */

import { runPsql } from './db-workflow-lib.ts';

const SENTINEL_SCHEMA = 'public';
const SENTINEL_TABLE = '_db_sentinel';
const SENTINEL_ID = '00000000-0000-0000-0000-000000000000';
const SENTINEL_LABEL = 'persistent-local-sentinel';

function cmdInsert(): void {
	// Create the sentinel table if it doesn't exist
	const createTable = `
CREATE TABLE IF NOT EXISTS ${SENTINEL_SCHEMA}.${SENTINEL_TABLE} (
  id uuid PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);`;
	const createResult = runPsql(createTable);
	if (createResult.status !== 0) {
		console.error(`ERROR: Failed to create sentinel table: ${createResult.stderr}`);
		process.exit(1);
	}

	// Insert or update the sentinel row
	const upsert = `
INSERT INTO ${SENTINEL_SCHEMA}.${SENTINEL_TABLE} (id, label, updated_at, metadata)
VALUES (
  '${SENTINEL_ID}'::uuid,
  '${SENTINEL_LABEL}',
  now(),
  jsonb_build_object('purpose', 'CI sentinel - do not delete. Proves persistent-local was not reset.')
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = now(),
  metadata = jsonb_build_object(
    'purpose', 'CI sentinel - do not delete. Proves persistent-local was not reset.',
    'last_check', now()::text
  );`;
	const upsertResult = runPsql(upsert);
	if (upsertResult.status !== 0) {
		console.error(`ERROR: Failed to upsert sentinel: ${upsertResult.stderr}`);
		process.exit(1);
	}

	console.info(`Sentinel inserted: ${SENTINEL_ID} (label: ${SENTINEL_LABEL})`);
}

function cmdCheck(): void {
	const query = `
SELECT count(*)::text
FROM ${SENTINEL_SCHEMA}.${SENTINEL_TABLE}
WHERE id = '${SENTINEL_ID}'::uuid
  AND label = '${SENTINEL_LABEL}';`;
	const result = runPsql(query);

	if (result.status !== 0) {
		console.error(`SENTINEL MISSING: Could not query sentinel table: ${result.stderr}`);
		process.exit(1);
	}

	const count = parseInt(result.stdout.trim(), 10);
	if (count === 1) {
		console.info(`SENTINEL OK: Persistent local database sentinel found (count=${count}).`);
		process.exit(0);
	} else {
		console.error(
			`SENTINEL MISSING: Persistent local database was reset! ` +
			`Expected sentinel row but found ${count}.`,
		);
		process.exit(1);
	}
}

function cmdRemove(): void {
	const result = runPsql(`DELETE FROM ${SENTINEL_SCHEMA}.${SENTINEL_TABLE} WHERE id = '${SENTINEL_ID}'::uuid;`);
	if (result.status !== 0) {
		console.error(`ERROR: Failed to remove sentinel: ${result.stderr}`);
		process.exit(1);
	}
	console.info('Sentinel removed.');
}

function main(): void {
	const command = process.argv[2];
	switch (command) {
		case 'insert':
			cmdInsert();
			break;
		case 'check':
			cmdCheck();
			break;
		case 'remove':
			cmdRemove();
			break;
		default:
			console.error('Usage: tsx scripts/db/sentinel-check.ts <insert|check|remove>');
			process.exit(1);
	}
}

main();
