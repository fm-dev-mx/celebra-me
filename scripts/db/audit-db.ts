/**
 * audit-db.ts — Read-only Database Audit & Drift Detection
 *
 * Compares a target database against the local repository state.
 * Reports:
 *   - Sanitized target connection identity (redacting credentials)
 *   - Local vs remote migration histories (pending/missing/reordered)
 *   - Canonical disposable reference validity before any target comparison
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
	runPsql,
	PROJECT_ROOT,
	resolveDbUrl,
	classifyDbTarget,
} from './db-workflow-lib.ts';
import { fetchRemoteMigrationVersions } from '../status-core/migration-history-reader.ts';
import { cmdStart, isDisposableDbReady } from './disposable-test-env.ts';
import { assertCurrentDisposableMigrationProof } from './disposable-migration-proof.ts';
import {
	REFERENCE_INVALID_LIFECYCLE,
	type DisposableReferenceVerdict,
} from './disposable-reference.ts';
import {
	runCanonicalObjectAudit,
	type ColumnMetadata,
	type GrantMetadata,
	type PolicyMetadata,
	type SchemaComparisonResult,
	type SchemaMetadata,
	type TableMetadata,
	type TriggerMetadata,
} from './audit-object-compare.ts';
import { classifySchemaLifecycle } from './schema-lifecycle-state.ts';
import {
	formatStructuralFinding,
	normalizeDef,
	type NamedConstraint,
	type NamedIndex,
	type NamedRoutine,
	type StructuralFinding,
} from './schema-object-contract.ts';

const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');

export type { SchemaMetadata } from './audit-object-compare.ts';
export {
	compareTargetToCanonicalReference,
	runCanonicalObjectAudit,
} from './audit-object-compare.ts';

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

function queryConstraints(dbUrl: string): NamedConstraint[] {
	return queryJson<NamedConstraint>(
		`select cls.relname as "tableName",
		        con.conname as "constraintName",
		        case con.contype
		          when 'p' then 'PRIMARY KEY'
		          when 'u' then 'UNIQUE'
		          when 'f' then 'FOREIGN KEY'
		          when 'c' then 'CHECK'
		          else con.contype::text
		        end as "constraintType",
		        pg_get_constraintdef(con.oid) as "definition"
		 from pg_constraint con
		 join pg_class cls on cls.oid = con.conrelid
		 join pg_namespace nsp on nsp.oid = cls.relnamespace
		 where nsp.nspname = 'public'
		   and cls.relname not in ('_db_sentinel', 'tap_funky', 'pg_all_foreign_keys')
		   and con.contype in ('p', 'u', 'f', 'c')
		 order by cls.relname, con.conname`,
		dbUrl,
	);
}

function queryIndexes(dbUrl: string): NamedIndex[] {
	return queryJson<NamedIndex>(
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

function queryRoutines(dbUrl: string): NamedRoutine[] {
	return queryJson<NamedRoutine>(
		`select p.proname as "routineName",
		        case p.prokind
		          when 'f' then 'FUNCTION'
		          when 'p' then 'PROCEDURE'
		          else p.prokind::text
		        end as "routineType",
		        pg_get_function_identity_arguments(p.oid) as "identityArgs",
		        pg_get_functiondef(p.oid) as "definition"
		 from pg_proc p
		 join pg_namespace n on n.oid = p.pronamespace
		 where n.nspname = 'public'
		   and p.prokind in ('f', 'p')
		   -- Disposable may expose pgcrypto wrappers in public; hosted keeps them in extensions.
		   and not exists (
		     select 1
		     from pg_depend d
		     join pg_extension e on e.oid = d.refobjid
		     where d.objid = p.oid and d.deptype = 'e'
		   )
		   and not exists (
		     select 1
		     from pg_proc ext
		     join pg_namespace extn on extn.oid = ext.pronamespace
		     where extn.nspname = 'extensions'
		       and ext.proname = p.proname
		       and pg_get_function_identity_arguments(ext.oid) = pg_get_function_identity_arguments(p.oid)
		   )
		 order by p.proname, pg_get_function_identity_arguments(p.oid)`,
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

function generateFingerprint(data: unknown): string {
	const str = JSON.stringify(data);
	return createHash('sha256').update(str).digest('hex');
}

function fingerprintPayload(meta: SchemaMetadata): unknown {
	return {
		tables: meta.tables,
		columns: meta.columns,
		constraints: meta.constraints.map((c) => ({
			...c,
			definition: normalizeDef(c.definition, c.constraintName),
		})),
		indexes: meta.indexes.map((i) => ({
			...i,
			indexDef: normalizeDef(i.indexDef, i.indexName),
		})),
		policies: meta.policies.map((p) => ({
			...p,
			qual: normalizeDef(p.qual || '', p.policyName),
			withCheck: normalizeDef(p.withCheck || '', p.policyName),
		})),
		triggers: meta.triggers,
		routines: meta.routines.map((r) => ({
			...r,
			definition: normalizeDef(r.definition, r.routineName),
		})),
		grants: meta.grants,
	};
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

function runMigrationsAudit(
	target: string,
	dbUrl: string,
): {
	remoteVersions: string[];
	extraRemoteCount: number;
	pendingLocal: string[];
	extraRemote: string[];
	isReordered: boolean;
	hasDivergentHistory: boolean;
	parityErrors: string[];
} {
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

	return {
		remoteVersions,
		extraRemoteCount: parity.extraRemote.length,
		pendingLocal: parity.pendingLocal,
		extraRemote: parity.extraRemote,
		isReordered: parity.isReordered,
		hasDivergentHistory: parity.hasDivergentHistory,
		parityErrors: parity.errors,
	};
}

function reportStructuralFindings(findings: readonly StructuralFinding[], blocking: boolean): void {
	if (findings.length === 0) {
		console.log(
			'✅ Named public indexes, constraints, and routines match the disposable contract.',
		);
		return;
	}
	for (const finding of findings) {
		const line = formatStructuralFinding(finding);
		if (blocking) {
			console.error(`❌ ERROR: ${line}`);
		} else {
			console.log(
				`   WARN: ${line} (reported while history is BEHIND; does not block migrate)`,
			);
		}
	}
}

function logReferenceFailure(reference: DisposableReferenceVerdict): void {
	console.error(`❌ ${REFERENCE_INVALID_LIFECYCLE}: ${reference.reason}`);
	console.error(`   Cause: ${reference.cause}`);
	if (reference.missingTables.length > 0) {
		console.error(`   Missing required tables: ${reference.missingTables.join(', ')}`);
	}
	console.error(`   Remediation: ${reference.remediation}`);
}

function logComparison(comparison: SchemaComparisonResult, historyLifecycle: string): void {
	for (const info of comparison.infos) {
		console.log(`   INFO: ${info}`);
	}
	for (const error of comparison.errors) {
		console.error(`❌ ERROR: ${error}`);
	}
	console.log(`Structural findings: ${comparison.structuralFindings.length}`);
	reportStructuralFindings(
		comparison.structuralFindings,
		historyLifecycle === 'CURRENT' || historyLifecycle === 'SCHEMA_DRIFT',
	);
}

function loadDisposableReferenceEvidence(expectedVersions: readonly string[]): {
	reachable: boolean;
	classificationTarget: string;
	liveVersions: string[] | null;
	liveTableNames: string[] | null;
	referenceSchema: SchemaMetadata | null;
	proofOk: boolean;
	proofAppliedVersions: string[] | null;
	introspectionError?: string;
} {
	const classification = classifyDbTarget(DISPOSABLE_DB_URL);
	let reachable = isDisposableDbReady();
	let startError: string | undefined;
	if (!reachable) {
		console.log(
			'Disposable reference database not running on port 54332. Starting disposable environment...',
		);
		try {
			cmdStart();
			reachable = isDisposableDbReady();
		} catch (err) {
			startError = err instanceof Error ? err.message : String(err);
			reachable = false;
		}
	}

	const proof = assertCurrentDisposableMigrationProof();

	if (!reachable) {
		return {
			reachable: false,
			classificationTarget: classification.target,
			liveVersions: null,
			liveTableNames: null,
			referenceSchema: null,
			proofOk: proof.ok,
			proofAppliedVersions: proof.proof?.appliedVersions ?? null,
			introspectionError: startError,
		};
	}

	try {
		const history = fetchRemoteMigrationVersions(DISPOSABLE_DB_URL);
		const local = fetchLocalSchemaMetadata();
		const localFingerprint = generateFingerprint(fingerprintPayload(local));
		console.log(`Local Schema Fingerprint:  ${localFingerprint}`);
		console.log(
			`Disposable reference migrations: ${history.remoteVersions.length}/${expectedVersions.length}`,
		);
		return {
			reachable: true,
			classificationTarget: classification.target,
			liveVersions: history.remoteVersions,
			liveTableNames: local.tables.map((table) => table.tableName),
			referenceSchema: local,
			proofOk: proof.ok,
			proofAppliedVersions: proof.proof?.appliedVersions ?? null,
		};
	} catch (err) {
		return {
			reachable: true,
			classificationTarget: classification.target,
			liveVersions: null,
			liveTableNames: null,
			referenceSchema: null,
			proofOk: proof.ok,
			proofAppliedVersions: proof.proof?.appliedVersions ?? null,
			introspectionError: err instanceof Error ? err.message : String(err),
		};
	}
}

interface SchemaAuditRun {
	errors: number;
	lifecycleOverride?: string;
}

function runSchemaAudit(
	target: string,
	dbUrl: string,
	initialErrors: number,
	historyLifecycle: string,
	expectedVersions: readonly string[],
): SchemaAuditRun {
	if (!existsSync(resolve(PROJECT_ROOT, 'supabase', 'test', 'seed-test-data.sql'))) {
		console.error('ERROR: Seed data file missing. Pipeline validation cannot run.');
		process.exit(1);
	}

	const prod = fetchSchemaMetadata(dbUrl);
	const targetFingerprint = generateFingerprint(fingerprintPayload(prod));
	console.log(`Target Schema Fingerprint: ${targetFingerprint}`);

	const evidence = loadDisposableReferenceEvidence(expectedVersions);
	const audit = runCanonicalObjectAudit({
		target,
		historyLifecycle,
		extraRemoteCount: initialErrors,
		reference: {
			reachable: evidence.reachable,
			classificationTarget: evidence.classificationTarget,
			expectedVersions,
			liveVersions: evidence.liveVersions,
			liveTableNames: evidence.liveTableNames,
			proofOk: evidence.proofOk,
			proofAppliedVersions: evidence.proofAppliedVersions,
			introspectionError: evidence.introspectionError,
		},
		targetSchema: prod,
		referenceSchema: evidence.referenceSchema,
	});

	if (!audit.reference.ok || !audit.comparison) {
		logReferenceFailure(audit.reference);
		console.error(`\n============================================================`);
		console.error(`Audit Verdict for ${target.toUpperCase()}:`);
		console.error(`Errors:   ${audit.errorCount}`);
		console.error(`============================================================\n`);
		return { errors: audit.errorCount, lifecycleOverride: REFERENCE_INVALID_LIFECYCLE };
	}

	console.log('Comparing schema against validated canonical disposable reference...');
	logComparison(audit.comparison, historyLifecycle);

	console.log(`\n============================================================`);
	console.log(`Audit Verdict for ${target.toUpperCase()}:`);
	console.log(`Errors:   ${audit.errorCount}`);
	console.log(`============================================================\n`);

	return { errors: audit.errorCount };
}

/** Shared audit verdict consumed by standalone CLI and migrate preflight. */
export interface SchemaAuditVerdict {
	lifecycle: string;
	errorCount: number;
	/** Standalone `pnpm db:prod:audit` success (not BEHIND, not drift). */
	passedStandalone: boolean;
	/** Migrate may proceed (CURRENT, or BEHIND with zero unexplained errors). */
	readyForMigrate: boolean;
}

export function buildSchemaAuditVerdict(lifecycle: string, errorCount: number): SchemaAuditVerdict {
	const readyForMigrate = errorCount === 0 && (lifecycle === 'CURRENT' || lifecycle === 'BEHIND');
	const passedStandalone = errorCount === 0 && lifecycle === 'CURRENT';
	return {
		lifecycle,
		errorCount,
		passedStandalone,
		readyForMigrate,
	};
}

/**
 * Parse subprocess audit output into the shared verdict.
 * Used when migrate embeds audit-db as a child process.
 */
export function parseSchemaAuditVerdictFromOutput(
	auditOutput: string,
	status: number,
): SchemaAuditVerdict {
	const lifecycleMatch = /Final schema lifecycle state:\s*(\S+)/.exec(auditOutput);
	const errorsMatch = /Errors:\s*(\d+)/.exec(auditOutput);
	const lifecycle = lifecycleMatch?.[1] ?? (status === 0 ? 'CURRENT' : 'SCHEMA_DRIFT');
	const errorCount = errorsMatch ? Number(errorsMatch[1]) : status === 0 ? 0 : 1;
	return buildSchemaAuditVerdict(lifecycle, errorCount);
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
	const migrationAudit = runMigrationsAudit(target, dbUrl);
	const historyLifecycle = classifySchemaLifecycle({
		pendingMigrations: migrationAudit.pendingLocal,
		extraMigrations: migrationAudit.extraRemote,
		mismatchedMigrations:
			migrationAudit.isReordered || migrationAudit.hasDivergentHistory
				? migrationAudit.extraRemote.length > 0
					? migrationAudit.extraRemote
					: ['divergent-history']
				: [],
		auditErrors: migrationAudit.parityErrors.filter(
			(e) => !e.startsWith('Pending local migrations'),
		),
		verified: true,
	});

	// --- 2. SCHEMA DRIFT COMPARISON & FINGERPRINT ---
	console.log('\n--- 2. Schema Comparison & Fingerprint ---');
	const localMigrationFiles = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	const expectedVersions = localMigrationFiles.map((f) => f.split('_')[0]!);
	const schemaAudit = runSchemaAudit(
		target,
		dbUrl,
		migrationAudit.extraRemoteCount,
		historyLifecycle,
		expectedVersions,
	);

	const finalLifecycle = schemaAudit.lifecycleOverride ?? historyLifecycle;
	console.log(`Final schema lifecycle state: ${finalLifecycle}`);
	console.log(
		'Evidence class: object_audit_readiness (history parity + named public object contract). Not equivalent to pnpm dbs migration_history_parity.',
	);

	const verdict = buildSchemaAuditVerdict(finalLifecycle, schemaAudit.errors);
	if (!verdict.passedStandalone) {
		if (verdict.lifecycle === REFERENCE_INVALID_LIFECYCLE) {
			console.error(
				`❌ AUDIT FAILED: Canonical disposable reference is invalid (${REFERENCE_INVALID_LIFECYCLE}). Production differences were not classified as schema drift.`,
			);
		} else if (verdict.lifecycle === 'BEHIND') {
			console.error(`❌ AUDIT FAILED: Target schema is BEHIND expected migrations.`);
		} else {
			console.error(
				`❌ AUDIT FAILED: Unexplained schema drift or history divergence detected (${verdict.lifecycle}).`,
			);
		}
		process.exit(1);
	}
	console.log(`✅ AUDIT PASSED: Schema state is verified and clean (${verdict.lifecycle}).`);
	process.exit(0);
}

if (process.argv[1]?.endsWith('audit-db.ts')) {
	try {
		main();
	} catch (err: unknown) {
		console.error('Fatal audit error:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
