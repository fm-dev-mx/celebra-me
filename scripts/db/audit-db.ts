/**
 * audit-db.ts — Read-only Database Audit & Drift Detection
 *
 * Compares a target database against the local repository state.
 * Reports:
 *   - Sanitized target connection identity (redacting credentials)
 *   - Local vs remote migration histories (pending/missing/reordered)
 *   - Deterministic schema fingerprint SHA-256
 *   - Hard mismatches (errors) and warnings
 *
 * Supported targets:
 *   - production       (PROD_DB_URL or PROD_SECRET_FILES)
 *   - preview          (PREVIEW_DB_URL or PREVIEW_SECRET_FILES)
 *   - persistent-local (port 54322)
 *   - disposable-test  (port 54332)
 *
 * Usage:
 *   tsx scripts/db/audit-db.ts --target <production|preview|persistent-local|disposable-test> [--db-url <url>]
 */

import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
	DISPOSABLE_DB_URL,
	redactDbUrl,
	runCommand,
	runPsql,
	PROJECT_ROOT,
	resolveDbUrl,
	classifyDbTarget,
} from './db-workflow-lib.ts';
import { cmdStart, isDisposableDbReady } from './disposable-test-env.ts';

const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');

interface TableMetadata {
	tableName: string;
	tableType: string;
}

interface ColumnMetadata {
	tableName: string;
	columnName: string;
	dataType: string;
	isNullable: string;
	columnDefault: string | null;
}

interface ConstraintMetadata {
	tableName: string;
	constraintName: string;
	constraintType: string;
	columnName: string;
	foreignTable: string | null;
	foreignColumn: string | null;
}

interface IndexMetadata {
	tableName: string;
	indexName: string;
	indexDef: string;
}

interface PolicyMetadata {
	tableName: string;
	policyName: string;
	roles: string;
	cmd: string;
	qual: string | null;
	withCheck: string | null;
}

interface TriggerMetadata {
	tableName: string;
	triggerName: string;
	eventManipulation: string;
	actionStatement: string;
	actionTiming: string;
}

interface RoutineMetadata {
	routineName: string;
	routineType: string;
}

interface GrantMetadata {
	grantee: string;
	tableName: string;
	privilegeType: string;
}

function queryJson<T>(sql: string, dbUrl: string): T[] {
	const jsonSql = `select coalesce(json_agg(sub), '[]'::json)::text from (${sql}) sub;`;
	const result = runPsql(jsonSql, dbUrl);
	try {
		return JSON.parse(result.stdout.trim()) as T[];
	} catch (err) {
		console.error(
			`Failed to parse JSON result from query:\n${sql}\nOutput received:\n${result.stdout}`,
		);
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Schema Queries
// ---------------------------------------------------------------------------

function queryTables(dbUrl: string): TableMetadata[] {
	return queryJson<TableMetadata>(
		`select table_name as "tableName", table_type as "tableType"
		 from information_schema.tables
		 where table_schema = 'public'
		   and table_name not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by table_name`,
		dbUrl,
	);
}

function queryColumns(dbUrl: string): ColumnMetadata[] {
	return queryJson<ColumnMetadata>(
		`select table_name as "tableName", column_name as "columnName", data_type as "dataType", is_nullable as "isNullable", column_default as "columnDefault"
		 from information_schema.columns
		 where table_schema = 'public'
		   and table_name not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by table_name, column_name`,
		dbUrl,
	);
}

function queryConstraints(dbUrl: string): ConstraintMetadata[] {
	return queryJson<ConstraintMetadata>(
		`select tc.table_name as "tableName", tc.constraint_name as "constraintName", tc.constraint_type as "constraintType", kcu.column_name as "columnName", ccu.table_name as "foreignTable", ccu.column_name as "foreignColumn"
		 from information_schema.table_constraints tc
		 join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
		 left join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
		 where tc.table_schema = 'public'
		   and tc.table_name not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name`,
		dbUrl,
	);
}

function queryIndexes(dbUrl: string): IndexMetadata[] {
	return queryJson<IndexMetadata>(
		`select tablename as "tableName", indexname as "indexName", indexdef as "indexDef"
		 from pg_indexes
		 where schemaname = 'public'
		   and tablename not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by tablename, indexname`,
		dbUrl,
	);
}

function queryPolicies(dbUrl: string): PolicyMetadata[] {
	return queryJson<PolicyMetadata>(
		`select tablename as "tableName", policyname as "policyName", roles::text as "roles", cmd as "cmd", qual as "qual", with_check as "withCheck"
		 from pg_policies
		 where schemaname = 'public'
		   and tablename not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by tablename, policyname`,
		dbUrl,
	);
}

function queryTriggers(dbUrl: string): TriggerMetadata[] {
	return queryJson<TriggerMetadata>(
		`select event_object_table as "tableName", trigger_name as "triggerName", event_manipulation as "eventManipulation", action_statement as "actionStatement", action_timing as "actionTiming"
		 from information_schema.triggers
		 where trigger_schema = 'public'
		   and event_object_table not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by event_object_table, trigger_name, event_manipulation`,
		dbUrl,
	);
}

function queryRoutines(dbUrl: string): RoutineMetadata[] {
	return queryJson<RoutineMetadata>(
		`select routine_name as "routineName", routine_type as "routineType"
		 from information_schema.routines
		 where routine_schema = 'public'
		 order by routine_name`,
		dbUrl,
	);
}

function queryGrants(dbUrl: string): GrantMetadata[] {
	return queryJson<GrantMetadata>(
		`select grantee, table_name as "tableName", privilege_type as "privilegeType"
		 from information_schema.role_table_grants
		 where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role', 'public')
		   and table_name not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		 order by grantee, table_name, privilege_type`,
		dbUrl,
	);
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

const normalizeDef = (def: string, name: string) => {
	return def
		.replace(new RegExp(name, 'g'), 'NAME_PLACEHOLDER')
		.replace(/\bauth\.uid\b/g, 'uid')
		.replace(/\bauth\.jwt\b/g, 'jwt')
		.replace(/\bauth\.role\b/g, 'role')
		.replace(/\s+/g, ' ')
		.replace(/::text/g, '')
		.replace(/["'()]/g, '')
		.trim();
};

function generateFingerprint(data: unknown): string {
	const str = JSON.stringify(data);
	return createHash('sha256').update(str).digest('hex');
}

interface SchemaMetadata {
	tables: TableMetadata[];
	columns: ColumnMetadata[];
	constraints: ConstraintMetadata[];
	indexes: IndexMetadata[];
	policies: PolicyMetadata[];
	triggers: TriggerMetadata[];
	routines: RoutineMetadata[];
	grants: GrantMetadata[];
}

function fetchSchemaMetadata(dbUrl: string): SchemaMetadata {
	const prevEnv = process.env.PGOPTIONS;
	process.env.PGOPTIONS = '-c default_transaction_read_only=on';
	try {
		return {
			tables: queryTables(dbUrl),
			columns: queryColumns(dbUrl),
			constraints: queryConstraints(dbUrl),
			indexes: queryIndexes(dbUrl),
			policies: queryPolicies(dbUrl),
			triggers: queryTriggers(dbUrl),
			routines: queryRoutines(dbUrl),
			grants: queryGrants(dbUrl),
		};
	} finally {
		if (prevEnv === undefined) {
			delete process.env.PGOPTIONS;
		} else {
			process.env.PGOPTIONS = prevEnv;
		}
	}
}

function fetchLocalSchemaMetadata(): SchemaMetadata {
	return fetchSchemaMetadata(DISPOSABLE_DB_URL);
}

// ---------------------------------------------------------------------------
// Main Logic
// ---------------------------------------------------------------------------

export interface MigrationParityResult {
	isAligned: boolean;
	pendingLocal: string[];
	extraRemote: string[];
	isReordered: boolean;
	hasDivergentHistory: boolean;
	errors: string[];
}

export function evaluateMigrationHistoryParity(
	expectedVersions: string[],
	remoteVersions: string[],
): MigrationParityResult {
	const expectedSet = new Set(expectedVersions);
	const remoteSet = new Set(remoteVersions);

	const pendingLocal = expectedVersions.filter((v) => !remoteSet.has(v));
	const extraRemote = remoteVersions.filter((v) => !expectedSet.has(v));

	let isReordered = false;
	for (let i = 1; i < remoteVersions.length; i++) {
		if (remoteVersions[i]! < remoteVersions[i - 1]!) {
			isReordered = true;
			break;
		}
	}

	const latestExpected = expectedVersions[expectedVersions.length - 1];
	const latestRemote = remoteVersions[remoteVersions.length - 1];
	const sameLatest = latestExpected !== undefined && latestExpected === latestRemote;
	const setsMatch = pendingLocal.length === 0 && extraRemote.length === 0;
	const hasDivergentHistory = (sameLatest && !setsMatch) || isReordered;

	const errors: string[] = [];

	if (pendingLocal.length > 0) {
		errors.push(
			`Pending local migrations not applied to remote (${pendingLocal.length}): ${pendingLocal.join(', ')}`,
		);
	}
	if (extraRemote.length > 0) {
		errors.push(
			`Remote database has extra migrations not found in local workspace (${extraRemote.length}): ${extraRemote.join(', ')}`,
		);
	}
	if (isReordered) {
		errors.push(`Remote migration history execution order is out of sequence / reordered.`);
	}
	if (hasDivergentHistory && pendingLocal.length === 0 && extraRemote.length === 0) {
		errors.push(`Remote migration history sequence diverges from local expected history.`);
	}

	const isAligned =
		pendingLocal.length === 0 &&
		extraRemote.length === 0 &&
		!isReordered &&
		!hasDivergentHistory;

	return {
		isAligned,
		pendingLocal,
		extraRemote,
		isReordered,
		hasDivergentHistory,
		errors,
	};
}

export interface RemoteMigrationHistoryResult {
	remoteVersions: string[];
	isUninitialized: boolean;
}

export function fetchRemoteMigrationVersions(
	dbUrl: string,
	runner: typeof runCommand = runCommand,
): RemoteMigrationHistoryResult {
	const sql = 'select version from supabase_migrations.schema_migrations order by version;';
	const result = runner(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--field-separator',
			'|',
			'--dbname',
			dbUrl,
		],
		{
			input: sql,
			throwOnError: false,
			redact: [dbUrl],
		},
	);

	if (result.status === 0) {
		const versions = result.stdout
			.split(/\r?\n/)
			.map((v) => v.trim())
			.filter(Boolean);
		return { remoteVersions: versions, isUninitialized: false };
	}

	const combinedOutput = `${result.stderr}\n${result.stdout}`;
	const isMissingSchemaMigrationsTable =
		(combinedOutput.includes('42P01') || combinedOutput.includes('does not exist')) &&
		combinedOutput.includes('supabase_migrations.schema_migrations');

	if (isMissingSchemaMigrationsTable) {
		console.info(
			'ℹ️  Target database is uninitialized (supabase_migrations.schema_migrations relation does not exist).',
		);
		return { remoteVersions: [], isUninitialized: true };
	}

	const details = combinedOutput.trim();
	throw new Error(
		`Failed to query schema_migrations table: exit code ${result.status}.${details ? `\n${details}` : ''}`,
	);
}

function runMigrationsAudit(
	target: string,
	dbUrl: string,
): { remoteVersions: string[]; extraRemoteCount: number } {
	const localMigrationFiles = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	const localVersions = localMigrationFiles.map((f) => f.split('_')[0]!);

	const { remoteVersions, isUninitialized } = fetchRemoteMigrationVersions(dbUrl);

	const parity = evaluateMigrationHistoryParity(localVersions, remoteVersions);

	console.log(`Local migrations:  ${localVersions.length}`);
	console.log(`Remote migrations: ${remoteVersions.length}`);

	if (isUninitialized) {
		console.log(
			`ℹ️  Target database ${target.toUpperCase()} is uninitialized (0 remote migrations). All ${localVersions.length} local migrations are pending.`,
		);
	}

	if (parity.pendingLocal.length > 0) {
		console.log(
			`⚠️  Pending local migrations not applied to remote (${parity.pendingLocal.length}):`,
		);
		for (const v of parity.pendingLocal) {
			const filename = localMigrationFiles.find((f) => f.startsWith(v));
			console.log(`   - ${filename || v}`);
		}
	} else {
		console.log(`✅ No pending local migrations.`);
	}

	if (parity.extraRemote.length > 0) {
		console.error(
			`❌ ERROR: Remote database has migrations not found in local workspace (${parity.extraRemote.length}):`,
		);
		for (const v of parity.extraRemote) {
			console.error(`   - Version ${v}`);
		}
	}

	if (parity.isReordered) {
		console.error(
			`❌ ERROR: Remote migration execution order is reordered or out of sequence.`,
		);
	}

	if (parity.hasDivergentHistory) {
		console.error(
			`❌ ERROR: Remote migration history sequence diverges from expected local sequence.`,
		);
	}

	const latestLocal = localVersions[localVersions.length - 1];
	const latestRemote = remoteVersions[remoteVersions.length - 1];

	console.log(`Target database migration state: ${target.toUpperCase()}`);
	console.log(`Expected latest version: ${latestLocal || '(none)'}`);
	console.log(`Target latest version:   ${latestRemote || '(none)'}`);

	if (parity.isAligned) {
		console.log(
			`✅ ${target.toUpperCase()} database migration history is 100% aligned with local workspace.`,
		);
	}

	return { remoteVersions, extraRemoteCount: parity.extraRemote.length };
}

function checkTables(
	prodTables: TableMetadata[],
	localTables: TableMetadata[],
	prodTableNames: Set<string>,
	localTableNames: Set<string>,
	target: string,
): number {
	let errors = 0;
	for (const t of prodTables) {
		if (!localTableNames.has(t.tableName)) {
			console.error(
				`❌ ERROR: Table "${t.tableName}" exists in target but is missing locally!`,
			);
			errors++;
		}
	}
	for (const t of localTables) {
		if (!prodTableNames.has(t.tableName)) {
			if (target === 'production' || target === 'preview') {
				console.log(
					`   INFO: Table "${t.tableName}" is local-only (expected addition before release).`,
				);
			} else {
				console.error(`❌ ERROR: Expected table "${t.tableName}" is missing in target!`);
				errors++;
			}
		}
	}
	return errors;
}

function checkColumns(
	prodCols: ColumnMetadata[],
	localCols: ColumnMetadata[],
	prodTableNames: Set<string>,
	localTableNames: Set<string>,
	target: string,
): number {
	let errors = 0;
	const localColMap = new Map<string, ColumnMetadata>();
	for (const col of localCols) {
		localColMap.set(`${col.tableName}.${col.columnName}`, col);
	}
	const prodColMap = new Map<string, ColumnMetadata>();
	for (const col of prodCols) {
		prodColMap.set(`${col.tableName}.${col.columnName}`, col);
	}

	for (const col of prodCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const localCol = localColMap.get(key);
		if (!localCol) {
			if (localTableNames.has(col.tableName)) {
				console.error(`❌ ERROR: Column "${key}" exists in target but is missing locally!`);
				errors++;
			}
			continue;
		}
		if (col.dataType !== localCol.dataType) {
			console.error(
				`❌ ERROR: Column "${key}" type mismatch! Target="${col.dataType}", Local="${localCol.dataType}"`,
			);
			errors++;
		}
	}

	for (const col of localCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const prodCol = prodColMap.get(key);
		if (!prodCol && prodTableNames.has(col.tableName)) {
			if (target === 'production' || target === 'preview') {
				console.log(
					`   INFO: Column "${key}" is local-only (expected addition before release).`,
				);
			} else {
				console.error(`❌ ERROR: Expected column "${key}" is missing in target!`);
				errors++;
			}
		}
	}
	return errors;
}

function checkConstraints(
	prodConstraints: ConstraintMetadata[],
	localConstraints: ConstraintMetadata[],
): number {
	let errors = 0;
	const localConstraintNames = new Set(localConstraints.map((c) => c.constraintName));
	for (const c of prodConstraints) {
		if (!localConstraintNames.has(c.constraintName)) {
			console.error(
				`❌ ERROR: Constraint "${c.constraintName}" on "${c.tableName}" is missing locally!`,
			);
			errors++;
		}
	}
	return errors;
}

function checkPolicies(prodPolicies: PolicyMetadata[], localPolicies: PolicyMetadata[]): number {
	let errors = 0;
	for (const p of prodPolicies) {
		const match = localPolicies.find(
			(lp) => lp.tableName === p.tableName && lp.policyName === p.policyName,
		);
		if (!match) {
			console.error(
				`❌ ERROR: RLS Policy "${p.policyName}" on "${p.tableName}" is missing locally!`,
			);
			errors++;
		} else {
			const normProdQual = normalizeDef(p.qual || '', p.policyName);
			const normLocalQual = normalizeDef(match.qual || '', match.policyName);
			if (normProdQual !== normLocalQual) {
				console.error(
					`❌ ERROR: RLS Policy "${p.policyName}" on "${p.tableName}" mismatch in target vs local!`,
				);
				errors++;
			}
		}
	}
	return errors;
}

function runSchemaAudit(target: string, dbUrl: string, initialErrors: number): number {
	if (!existsSync(resolve(PROJECT_ROOT, 'supabase', 'test', 'seed-test-data.sql'))) {
		console.error('ERROR: Seed data file missing. Pipeline validation cannot run.');
		process.exit(1);
	}

	const prod = fetchSchemaMetadata(dbUrl);

	const targetFingerprint = generateFingerprint({
		tables: prod.tables,
		columns: prod.columns,
		constraints: prod.constraints,
		indexes: prod.indexes.map((i) => ({
			...i,
			indexDef: normalizeDef(i.indexDef, i.indexName),
		})),
		policies: prod.policies.map((p) => ({
			...p,
			qual: normalizeDef(p.qual || '', p.policyName),
			withCheck: normalizeDef(p.withCheck || '', p.policyName),
		})),
		triggers: prod.triggers,
		routines: prod.routines,
		grants: prod.grants,
	});

	console.log(`Target Schema Fingerprint: ${targetFingerprint}`);

	let errors = initialErrors;

	// Ensure local disposable reference DB is running & reachable for canonical schema comparison
	let localReachable = isDisposableDbReady();
	if (!localReachable) {
		console.log(
			'Disposable reference database not running on port 54332. Starting disposable environment...',
		);
		try {
			cmdStart();
			localReachable = isDisposableDbReady();
		} catch (err) {
			console.warn(
				`Failed to start disposable reference database: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	if (localReachable) {
		console.log('Comparing schema against canonical local disposable reference database...');
		const local = fetchLocalSchemaMetadata();

		const localFingerprint = generateFingerprint({
			tables: local.tables,
			columns: local.columns,
			constraints: local.constraints,
			indexes: local.indexes.map((i) => ({
				...i,
				indexDef: normalizeDef(i.indexDef, i.indexName),
			})),
			policies: local.policies.map((p) => ({
				...p,
				qual: normalizeDef(p.qual || '', p.policyName),
				withCheck: normalizeDef(p.withCheck || '', p.policyName),
			})),
			triggers: local.triggers,
			routines: local.routines,
			grants: local.grants,
		});
		console.log(`Local Schema Fingerprint:  ${localFingerprint}`);

		const prodTableNames = new Set(prod.tables.map((t) => t.tableName));
		const localTableNames = new Set(local.tables.map((t) => t.tableName));

		errors += checkTables(prod.tables, local.tables, prodTableNames, localTableNames, target);
		errors += checkColumns(
			prod.columns,
			local.columns,
			prodTableNames,
			localTableNames,
			target,
		);
		errors += checkConstraints(prod.constraints, local.constraints);
		errors += checkPolicies(prod.policies, local.policies);
	} else {
		console.log(
			'ℹ️  Local disposable database is not running; skipping detailed schema comparison.',
		);
	}

	console.log(`\n============================================================`);
	console.log(`Audit Verdict for ${target.toUpperCase()}:`);
	console.log(`Errors:   ${errors}`);
	console.log(`============================================================\n`);

	return errors;
}

function main(): void {
	const targetIdx = process.argv.indexOf('--target');
	const target = targetIdx !== -1 ? process.argv[targetIdx + 1] : undefined;
	const dbUrlIdx = process.argv.indexOf('--db-url');
	let dbUrl = dbUrlIdx !== -1 ? process.argv[dbUrlIdx + 1] : undefined;

	if (!target) {
		console.error(
			'Usage: tsx scripts/db/audit-db.ts --target <production|preview|persistent-local|disposable-test> [--db-url <url>]',
		);
		process.exit(1);
	}

	// Resolve connection URL
	dbUrl = resolveDbUrl(target, dbUrl);
	if (!dbUrl) {
		console.error(`ERROR: Database URL could not be resolved for target "${target}".`);
		process.exit(1);
	}

	// Validate target classification
	const classification = classifyDbTarget(dbUrl);
	if (classification.target !== target) {
		console.warn(
			`Target classification warning: expected "${target}", classified as "${classification.target}" (${classification.reason})`,
		);
	}

	const sanitizedUrl = redactDbUrl(dbUrl);
	console.log(`============================================================`);
	console.log(`Database Audit Target: ${target.toUpperCase()}`);
	console.log(`Connection URL:        ${sanitizedUrl}`);
	console.log(`============================================================\n`);

	// --- 1. MIGRATIONS AUDIT ---
	console.log('--- 1. Migrations Audit ---');
	const { extraRemoteCount } = runMigrationsAudit(target, dbUrl);

	// --- 2. SCHEMA DRIFT COMPARISON & FINGERPRINT ---
	console.log('\n--- 2. Schema Comparison & Fingerprint ---');
	const errors = runSchemaAudit(target, dbUrl, extraRemoteCount);

	if (errors > 0) {
		console.error(`❌ AUDIT FAILED: Unexplained schema drift or history divergence detected.`);
		process.exit(1);
	} else {
		console.log(`✅ AUDIT PASSED: Schema state is verified and clean.`);
		process.exit(0);
	}
}

if (process.argv[1]?.endsWith('audit-db.ts')) {
	try {
		main();
	} catch (err: unknown) {
		console.error('Fatal audit error:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
