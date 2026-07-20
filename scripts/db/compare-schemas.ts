/**
 * compare-schemas.ts — Schema Parity Gate and Drift Audit (JSON-based)
 *
 * Compares the public schema of the production database against the local
 * disposable database (representing all repository migrations applied).
 *
 * Verifies that the local schema is a strict, compatible superset of production.
 *
 * Usage:
 *   tsx scripts/db/compare-schemas.ts
 */

import { DISPOSABLE_DB_URL, getProdDbUrl, redactDbUrl, runPsql } from './db-workflow-lib.ts';


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

// Allowed local-only additions from the 13 newer migrations
const ALLOWED_LOCAL_ADDITIONS = {
	tables: new Set([
		'audit_logs',
		'tracking_events',
		'visitor_sessions',
		'meta_conversion_events',
		'meta_conversion_delivery_attempts',
		'meta_conversion_recoveries',
		'sales_orders',
		'customers',
		'commercial_record_classifications',
		'deleted_events',
		'pg_all_foreign_keys',
		'tap_funky',
	]),
	columns: new Map<string, string[]>([
		['invitations', ['first_shared_at', 'source_invitation_id']],
		['guest_invitations', ['last_reminder_sent_at', 'first_shared_at']],
		['events', ['invitation_project_id']],
		['invitation_assets', ['validation_version', 'original_mime_type', 'original_file_size']],
	]),
	indexes: new Set([
		'idx_invitations_source_invitation_id',
		'idx_guest_invitations_last_reminder',
		'idx_events_invitation_project_id',
		'idx_sales_orders_idempotency_key_unique',
		'idx_guest_invitations_phone_e164',
		'idx_guest_invitations_phone',
	]),
	policies: new Set([
		'service_role read all events',
		'service_role read all invitations',
		'service_role read all published_invitation_content',
	]),
	functions: new Set([
		'publish_invitation_atomic',
		'get_asset_delivery_url',
	]),
};

function queryJson<T>(sql: string, dbUrl: string): T[] {
	const jsonSql = `select coalesce(json_agg(sub), '[]'::json)::text from (${sql}) sub;`;
	const result = runPsql(jsonSql, dbUrl);
	try {
		return JSON.parse(result.stdout.trim()) as T[];
	} catch (err) {
		console.error(`Failed to parse JSON result from query:\n${sql}\nOutput received:\n${result.stdout}`);
		throw err;
	}
}

function queryTables(dbUrl: string): TableMetadata[] {
	return queryJson<TableMetadata>(
		`select table_name as "tableName", table_type as "tableType"
		 from information_schema.tables
		 where table_schema = 'public'`,
		dbUrl
	);
}

function queryColumns(dbUrl: string): ColumnMetadata[] {
	return queryJson<ColumnMetadata>(
		`select table_name as "tableName", column_name as "columnName", data_type as "dataType", is_nullable as "isNullable", column_default as "columnDefault"
		 from information_schema.columns
		 where table_schema = 'public'`,
		dbUrl
	);
}

function queryConstraints(dbUrl: string): ConstraintMetadata[] {
	return queryJson<ConstraintMetadata>(
		`select tc.table_name as "tableName", tc.constraint_name as "constraintName", tc.constraint_type as "constraintType", kcu.column_name as "columnName", ccu.table_name as "foreignTable", ccu.column_name as "foreignColumn"
		 from information_schema.table_constraints tc
		 join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
		 left join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
		 where tc.table_schema = 'public'`,
		dbUrl
	);
}

function queryIndexes(dbUrl: string): IndexMetadata[] {
	return queryJson<IndexMetadata>(
		`select tablename as "tableName", indexname as "indexName", indexdef as "indexDef"
		 from pg_indexes
		 where schemaname = 'public'`,
		dbUrl
	);
}

function queryPolicies(dbUrl: string): PolicyMetadata[] {
	return queryJson<PolicyMetadata>(
		`select tablename as "tableName", policyname as "policyName", roles::text as "roles", cmd as "cmd", qual as "qual", with_check as "withCheck"
		 from pg_policies
		 where schemaname = 'public'`,
		dbUrl
	);
}

function queryTriggers(dbUrl: string): TriggerMetadata[] {
	return queryJson<TriggerMetadata>(
		`select event_object_table as "tableName", trigger_name as "triggerName", event_manipulation as "eventManipulation", action_statement as "actionStatement", action_timing as "actionTiming"
		 from information_schema.triggers
		 where trigger_schema = 'public'`,
		dbUrl
	);
}

const normalizeDef = (def: string, name: string) => {
	return def.replace(new RegExp(name, 'g'), 'NAME_PLACEHOLDER')
		.replace(/\bauth\.uid\b/g, 'uid')
		.replace(/\bauth\.jwt\b/g, 'jwt')
		.replace(/\bauth\.role\b/g, 'role')
		.replace(/\s+/g, ' ')
		.replace(/::text/g, '')
		.replace(/["'()]/g, '')
		.trim();
};

function auditTables(prodTables: TableMetadata[], localTables: TableMetadata[]): { errors: number; warnings: number } {
	let errors = 0;
	let warnings = 0;
	console.log('\n--- 1. Tables Audit ---');
	const prodTableNames = new Set(prodTables.map((t) => t.tableName));
	const localTableNames = new Set(localTables.map((t) => t.tableName));

	for (const table of prodTableNames) {
		if (!localTableNames.has(table)) {
			console.error(`❌ ERROR: Table "${table}" exists in production but is missing locally!`);
			errors++;
		}
	}

	for (const table of localTableNames) {
		if (!prodTableNames.has(table)) {
			if (ALLOWED_LOCAL_ADDITIONS.tables.has(table)) {
				console.log(`ℹ️  INFO: Table "${table}" is local-only (expected addition from migrations)`);
			} else {
				console.warn(`⚠️  WARNING: Table "${table}" is local-only but not in the approved migrations list!`);
				warnings++;
			}
		}
	}
	return { errors, warnings };
}

function auditColumns(
	prodCols: ColumnMetadata[],
	localCols: ColumnMetadata[],
	prodTableNames: Set<string>,
): { errors: number; warnings: number } {
	let errors = 0;
	let warnings = 0;
	console.log('\n--- 2. Columns Audit ---');
	const localColMap = new Map<string, ColumnMetadata>();
	for (const col of localCols) {
		localColMap.set(`${col.tableName}.${col.columnName}`, col);
	}

	for (const col of prodCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const localCol = localColMap.get(key);

		if (!localCol) {
			console.error(`❌ ERROR: Column "${key}" exists in production but is missing locally!`);
			errors++;
			continue;
		}

		if (col.dataType !== localCol.dataType) {
			console.error(`❌ ERROR: Column "${key}" type mismatch! Production="${col.dataType}", Local="${localCol.dataType}"`);
			errors++;
		}

		if (col.isNullable !== localCol.isNullable) {
			if (localCol.isNullable === 'NO' && col.isNullable === 'YES' && !localCol.columnDefault) {
				console.error(`❌ ERROR: Column "${key}" nullability mismatch! Production=NULL, Local=NOT NULL without default!`);
				errors++;
			} else {
				console.warn(`⚠️  WARNING: Column "${key}" nullability mismatch. Production="${col.isNullable}", Local="${localCol.isNullable}"`);
				warnings++;
			}
		}
	}

	for (const col of localCols) {
		const key = `${col.tableName}.${col.columnName}`;
		const prodCol = prodCols.find((pc) => pc.tableName === col.tableName && pc.columnName === col.columnName);
		
		if (!prodCol && prodTableNames.has(col.tableName)) {
			const allowedCols = ALLOWED_LOCAL_ADDITIONS.columns.get(col.tableName) || [];
			if (allowedCols.includes(col.columnName)) {
				console.log(`ℹ️  INFO: Column "${key}" is local-only (expected addition from migrations)`);
			} else {
				console.warn(`⚠️  WARNING: Column "${key}" is local-only but not in the approved migrations list!`);
				warnings++;
			}
		}
	}
	return { errors, warnings };
}

function auditConstraints(prodConstraints: ConstraintMetadata[], localConstraints: ConstraintMetadata[]): { errors: number } {
	let errors = 0;
	console.log('\n--- 3. Constraints Audit ---');
	const localConstraintNames = new Set(localConstraints.map((c) => c.constraintName));
	for (const c of prodConstraints) {
		if (!localConstraintNames.has(c.constraintName)) {
			console.error(`❌ ERROR: Constraint "${c.constraintName}" on "${c.tableName}" (${c.constraintType}) is missing locally!`);
			errors++;
		}
	}
	return { errors };
}

function auditIndexes(prodIndexes: IndexMetadata[], localIndexes: IndexMetadata[]): { errors: number } {
	let errors = 0;
	console.log('\n--- 4. Indexes Audit ---');
	for (const prodIdx of prodIndexes) {
		const hasByName = localIndexes.some((li) => li.indexName === prodIdx.indexName);
		const normalizedProd = normalizeDef(prodIdx.indexDef, prodIdx.indexName);
		const hasByDef = localIndexes.some((li) => {
			if (li.tableName !== prodIdx.tableName) return false;
			return normalizeDef(li.indexDef, li.indexName) === normalizedProd;
		});

		if (!hasByName && !hasByDef) {
			console.error(`❌ ERROR: Index "${prodIdx.indexName}" on "${prodIdx.tableName}" is missing locally!`);
			errors++;
		} else if (!hasByName && hasByDef) {
			console.log(`ℹ️  INFO: Index on "${prodIdx.tableName}" exists locally but under a different name (cosmetic only)`);
		}
	}
	return { errors };
}

function auditPolicies(prodPolicies: PolicyMetadata[], localPolicies: PolicyMetadata[]): { errors: number; warnings: number } {
	let errors = 0;
	let warnings = 0;
	console.log('\n--- 5. RLS Policies Audit ---');
	for (const prodPol of prodPolicies) {
		const match = localPolicies.find((lp) => lp.tableName === prodPol.tableName && lp.policyName === prodPol.policyName);

		if (!match) {
			console.error(`❌ ERROR: RLS Policy "${prodPol.policyName}" on "${prodPol.tableName}" is missing locally!`);
			errors++;
		} else {
			const normProdQual = normalizeDef(prodPol.qual || '', prodPol.policyName);
			const normLocalQual = normalizeDef(match.qual || '', match.policyName);
			const normProdCheck = normalizeDef(prodPol.withCheck || '', prodPol.policyName);
			const normLocalCheck = normalizeDef(match.withCheck || '', match.policyName);

			if (normProdQual !== normLocalQual || normProdCheck !== normLocalCheck) {
				console.warn(`⚠️  WARNING: RLS Policy "${prodPol.policyName}" on "${prodPol.tableName}" has different logic locally!`);
				warnings++;
			}
		}
	}
	return { errors, warnings };
}

function auditTriggers(prodTriggers: TriggerMetadata[], localTriggers: TriggerMetadata[]): { errors: number } {
	let errors = 0;
	console.log('\n--- 6. Triggers Audit ---');
	for (const prodTrg of prodTriggers) {
		const match = localTriggers.find((lt) => lt.tableName === prodTrg.tableName && lt.triggerName === prodTrg.triggerName);

		if (!match) {
			console.error(`❌ ERROR: Trigger "${prodTrg.triggerName}" on "${prodTrg.tableName}" is missing locally!`);
			errors++;
		}
	}
	return { errors };
}

function main(): void {
	const { url: prodDbUrl } = getProdDbUrl();
	
	console.log('╔══════════════════════════════════════════════════════════╗');
	console.log('║               Schema Parity Audit Gate                   ║');
	console.log('╚══════════════════════════════════════════════════════════╝');
	console.log(`- Production: ${redactDbUrl(prodDbUrl)}`);
	console.log(`- Local (Disposable): ${redactDbUrl(DISPOSABLE_DB_URL)}`);
	console.log('\nFetching schema metadata from databases...');

	const prevEnv = process.env.PGOPTIONS;
	process.env.PGOPTIONS = '-c default_transaction_read_only=on';
	
	let prodTables: TableMetadata[], localTables: TableMetadata[];
	let prodCols: ColumnMetadata[], localCols: ColumnMetadata[];
	let prodConstraints: ConstraintMetadata[], localConstraints: ConstraintMetadata[];
	let prodIndexes: IndexMetadata[], localIndexes: IndexMetadata[];
	let prodPolicies: PolicyMetadata[], localPolicies: PolicyMetadata[];
	let prodTriggers: TriggerMetadata[], localTriggers: TriggerMetadata[];

	try {
		prodTables = queryTables(prodDbUrl);
		localTables = queryTables(DISPOSABLE_DB_URL);
		prodCols = queryColumns(prodDbUrl);
		localCols = queryColumns(DISPOSABLE_DB_URL);
		prodConstraints = queryConstraints(prodDbUrl);
		localConstraints = queryConstraints(DISPOSABLE_DB_URL);
		prodIndexes = queryIndexes(prodDbUrl);
		localIndexes = queryIndexes(DISPOSABLE_DB_URL);
		prodPolicies = queryPolicies(prodDbUrl);
		localPolicies = queryPolicies(DISPOSABLE_DB_URL);
		prodTriggers = queryTriggers(prodDbUrl);
		localTriggers = queryTriggers(DISPOSABLE_DB_URL);
	} finally {
		process.env.PGOPTIONS = prevEnv;
	}

	const prodTableNames = new Set(prodTables.map((t) => t.tableName));

	const resTables = auditTables(prodTables, localTables);
	const resCols = auditColumns(prodCols, localCols, prodTableNames);
	const resConstraints = auditConstraints(prodConstraints, localConstraints);
	const resIndexes = auditIndexes(prodIndexes, localIndexes);
	const resPolicies = auditPolicies(prodPolicies, localPolicies);
	const resTriggers = auditTriggers(prodTriggers, localTriggers);

	const errors = resTables.errors + resCols.errors + resConstraints.errors + resIndexes.errors + resPolicies.errors + resTriggers.errors;
	const warnings = resTables.warnings + resCols.warnings + resPolicies.warnings;

	console.log('\n============================================================');
	console.log(`Schema Parity Audit Complete.`);
	console.log(`Errors (Hard Mismatches): ${errors}`);
	console.log(`Warnings (Minor Drift):   ${warnings}`);
	console.log('============================================================');

	if (errors > 0) {
		console.error('\n❌ SCHEMA PARITY FAILED: Hard schema differences exist that could cause restore or runtime failures.');
		process.exit(1);
	} else {
		console.log('\n✅ SCHEMA PARITY PASSED: Local schema is a compatible superset of production.');
		process.exit(0);
	}
}

try {
	main();
} catch (err: unknown) {
	console.error('Fatal comparison error:', err instanceof Error ? err.message : String(err));
	process.exit(1);
}
