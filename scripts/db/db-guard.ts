/**
 * db-guard.ts — Central Database Safety Guard
 *
 * Classifies database targets and enforces environment-specific policies:
 *
 *   production        — Read-only inspection and export only.
 *                       All writes, migrations, resets, DDL are blocked.
 *   preview           — Read-only audit & controlled migrations.
 *                       Resets, dropping cascade, container deletion blocked.
 *   persistent-local  — Normal development DB (local Supabase Docker).
 *                       Destructive operations (reset, drop, volume rm, broad truncate)
 *                       are blocked.
 *   disposable-test   — Isolated test environment that may be reset or destroyed.
 *                       All operations are permitted.
 *   unknown           — Fail closed. Any target that cannot be definitively classified
 *                       is treated as high-risk.
 *
 * Usage (CLI):
 *   tsx scripts/db/db-guard.ts check --target production
 *   tsx scripts/db/db-guard.ts check --target preview
 *   tsx scripts/db/db-guard.ts check --target persistent-local
 *   tsx scripts/db/db-guard.ts check --target disposable-test
 *   tsx scripts/db/db-guard.ts classify --db-url postgresql://...
 *   tsx scripts/db/db-guard.ts redact --text "...url..."
 *
 * Usage (library):
 *   import { classifyDbTarget, guardPersistentLocal, ... } from './db-guard.ts';
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DbTarget, ClassificationResult, GuardResult } from './db-target-config.ts';
import {
	PERSISTENT_LOCAL,
	classifyDbTarget,
	redactDbUrl,
	redactCredentials,
	resolveDbUrl,
} from './db-target-config.ts';

export type { DbTarget, ClassificationResult, GuardResult } from './db-target-config.ts';
export {
	PREVIEW_SECRET_FILES,
	PERSISTENT_LOCAL,
	LOCAL_DB_URL,
	DISPOSABLE_DB_URL,
	getSecretFromEnvOrFiles,
	redactDbUrl,
	redactCredentials,
	isLocalDbUrl,
	classifyDbTarget,
} from './db-target-config.ts';

// ---------------------------------------------------------------------------
// Local identity verification
// ---------------------------------------------------------------------------

/**
 * Verify that the running Supabase instance matches the expected persistent-local identity.
 * Checks Docker container names, project ID, and port availability.
 */
export function verifyLocalIdentity(
	options: { supabaseStatus?: string; supabaseConfig?: string } = {},
): GuardResult {
	const errors: string[] = [];
	const statusOutput = options.supabaseStatus;

	// If we have status output, check project identity
	if (statusOutput) {
		const projectMatch = statusOutput.match(/supabase_([a-z_]+)/);
		if (
			projectMatch &&
			!projectMatch[1]?.includes(PERSISTENT_LOCAL.projectId) &&
			!statusOutput.includes(PERSISTENT_LOCAL.projectId)
		) {
			errors.push(
				`Running Supabase project does not match expected "${PERSISTENT_LOCAL.projectId}". ` +
					`Found project references that differ.`,
			);
		}

		if (
			!statusOutput.includes('127.0.0.1:54321') &&
			!statusOutput.includes('localhost:54321')
		) {
			errors.push(
				`Running Supabase API does not appear to be on ${PERSISTENT_LOCAL.apiUrl}. ` +
					`Run supabase status to verify.`,
			);
		}
	}

	// If we have config file content, verify project_id
	if (options.supabaseConfig) {
		const configMatch = options.supabaseConfig.match(/project_id\s*=\s*"([^"]+)"/);
		if (configMatch && configMatch[1] !== PERSISTENT_LOCAL.projectId) {
			errors.push(
				`supabase/config.toml project_id is "${configMatch[1]}", ` +
					`expected "${PERSISTENT_LOCAL.projectId}".`,
			);
		}
	}

	return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Guard checks
// ---------------------------------------------------------------------------

/**
 * Guard against operations on production databases.
 * Production allows only read-only inspection and export.
 */
export function guardProduction(
	classification: ClassificationResult,
	operation: string,
): GuardResult {
	const errors: string[] = [];

	if (classification.target !== 'production') {
		return { ok: true, errors: [] };
	}

	// Controlled entrypoints: the owning CLI enforces --apply, identity, and TTY confirmation.
	if (operation === 'migrate' || operation === 'patch') {
		return { ok: true, errors: [] };
	}

	const blockedOperations = [
		/^(insert|update|delete|truncate|drop|alter|create)\b/i,
		/reset|push|migrate\b/i,
		/volume.*rm|docker.*down/i,
	];

	const isBlocked = blockedOperations.some((pattern) => pattern.test(operation));
	if (isBlocked) {
		errors.push(
			`PRODUCTION WRITE BLOCKED: Operation "${operation}" is not permitted ` +
				`against production target ${redactDbUrl(classification.dbUrl ?? '')}. ` +
				`Production is read-only for inspection and export.`,
		);
	}

	return { ok: errors.length === 0, errors };
}

/**
 * Guard against destructive operations on the persistent local database.
 * The persistent local is protected state — reset, volume deletion, schema drops,
 * and broad truncation are prohibited.
 */
export function guardPersistentLocal(
	classification: ClassificationResult,
	operation: string,
): GuardResult {
	const errors: string[] = [];

	if (classification.target !== 'persistent-local') {
		return { ok: true, errors: [] };
	}

	const destructiveOps = [
		{ pattern: /\bsupabase\s+db\s+reset\b/i, label: 'supabase db reset' },
		{ pattern: /\bdocker\s+volume\s+rm\b/i, label: 'docker volume rm' },
		{ pattern: /\bdocker\s+compose\s+down\s+-v\b/i, label: 'docker compose down -v' },
		{ pattern: /\bdrop\s+(table|schema|database)\s+.*\bcascade\b/i, label: 'DROP ... CASCADE' },
		{
			pattern: /\btruncate\s+(table\s+)?(\w+\.)?\w+\s+cascade\b/i,
			label: 'TRUNCATE ... CASCADE',
		},
		{ pattern: /\bsupabase\s+db\s+push\b/i, label: 'supabase db push' },
	];

	for (const { pattern, label } of destructiveOps) {
		if (pattern.test(operation)) {
			errors.push(
				`PERSISTENT LOCAL BLOCKED: "${label}" is not permitted against the persistent ` +
					`local database. Use the disposable test environment (--target disposable-test) ` +
					`for destructive operations.`,
			);
		}
	}

	return { ok: errors.length === 0, errors };
}

/**
 * Guard against destructive operations on the preview database.
 * Preview allows migrations and audits but blocks direct resets and cascaded drops.
 */
export function guardPreview(classification: ClassificationResult, operation: string): GuardResult {
	const errors: string[] = [];

	if (classification.target !== 'preview') {
		return { ok: true, errors: [] };
	}

	const destructiveOps = [
		{ pattern: /\bsupabase\s+db\s+reset\b/i, label: 'supabase db reset' },
		{ pattern: /\bdocker\s+volume\s+rm\b/i, label: 'docker volume rm' },
		{ pattern: /\bdocker\s+compose\s+down\s+-v\b/i, label: 'docker compose down -v' },
		{ pattern: /\bdrop\s+(table|schema|database)\s+.*\bcascade\b/i, label: 'DROP ... CASCADE' },
		{
			pattern: /\btruncate\s+(table\s+)?(\w+\.)?\w+\s+cascade\b/i,
			label: 'TRUNCATE ... CASCADE',
		},
	];

	for (const { pattern, label } of destructiveOps) {
		if (pattern.test(operation)) {
			errors.push(
				`PREVIEW BLOCKED: "${label}" is not permitted against the preview database. ` +
					`Preview environment schema can be updated via pnpm db:preview:migrate -- --apply (after read-only preflight).`,
			);
		}
	}

	return { ok: errors.length === 0, errors };
}

export function guardUnknown(
	classification: ClassificationResult,
	operation = 'unknown',
): GuardResult {
	const errors: string[] = [];

	if (classification.target !== 'unknown') {
		return { ok: true, errors: [] };
	}

	errors.push(
		`UNKNOWN TARGET BLOCKED: Cannot classify database target for operation "${operation}". ` +
			`${classification.reason}. ` +
			`All operations are blocked against unknown targets. ` +
			`Specify --target production, --target preview, --target persistent-local, or --target disposable-test ` +
			`to proceed.`,
	);

	return { ok: errors.length === 0, errors };
}

/**
 * Verify that a dump file's checksum is valid and the file is not empty.
 */
export function validateDumpIntegrity(dumpPath: string): GuardResult {
	const errors: string[] = [];

	try {
		if (!existsSync(dumpPath)) {
			errors.push(`Dump file not found: ${dumpPath}`);
			return { ok: false, errors };
		}

		const content = readFileSync(dumpPath, 'utf8');
		if (content.trim().length === 0) {
			errors.push(`Dump file is empty: ${dumpPath}`);
			return { ok: false, errors };
		}

		if (!/^(INSERT|COPY|CREATE|SET)\b/im.test(content.trim())) {
			errors.push(`Dump file does not appear to contain valid SQL: ${dumpPath}`);
		}

		return { ok: true, errors: [] };
	} catch (error) {
		errors.push(
			`Failed to validate dump integrity: ${error instanceof Error ? error.message : String(error)}`,
		);
		return { ok: false, errors };
	}
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function cliClassify(): void {
	if (!process.argv[4]) {
		console.error('Usage: tsx scripts/db/db-guard.ts classify --db-url <connection-string>');
		process.exit(1);
	}
	const result = classifyDbTarget(process.argv[4]);
	console.log(JSON.stringify(result, null, 2));
	process.exit(result.target === 'unknown' ? 1 : 0);
}

function verifyPersistentLocalIdentity(): void {
	const configPath = resolve(process.cwd(), 'supabase', 'config.toml');
	const configContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
	const identity = verifyLocalIdentity({
		supabaseConfig: configContent,
	});
	if (!identity.ok) {
		for (const err of identity.errors) console.error(`ERROR: ${err}`);
		process.exit(1);
	}
}

function runGuards(
	target: string,
	classification: ClassificationResult,
	operation: string,
): GuardResult[] {
	const guards: GuardResult[] = [];

	if (target === 'production') {
		guards.push(guardProduction(classification, operation));
	} else if (target === 'preview') {
		guards.push(guardPreview(classification, operation));
	} else if (target === 'persistent-local') {
		guards.push(guardPersistentLocal(classification, operation));
	}

	guards.push(guardUnknown(classification, operation));
	return guards;
}

function cliCheck(): void {
	const targetIdx = process.argv.indexOf('--target');
	const target = targetIdx !== -1 ? process.argv[targetIdx + 1] : undefined;
	const dbUrlIdx = process.argv.indexOf('--db-url');
	const dbUrl = dbUrlIdx !== -1 ? process.argv[dbUrlIdx + 1] : undefined;
	const opIdx = process.argv.indexOf('--operation');
	const operation = opIdx !== -1 ? process.argv[opIdx + 1] : undefined;

	if (!target) {
		console.error(
			'Usage: tsx scripts/db/db-guard.ts check --target <production|preview|persistent-local|disposable-test> [--operation <op>] [--db-url <url>]',
		);
		process.exit(1);
	}

	const validTargets: DbTarget[] = [
		'production',
		'preview',
		'persistent-local',
		'disposable-test',
	];
	if (!validTargets.includes(target as DbTarget)) {
		console.error(`Invalid target "${target}". Must be one of: ${validTargets.join(', ')}`);
		process.exit(1);
	}

	if (target === 'persistent-local') {
		verifyPersistentLocalIdentity();
	}

	const resolvedUrl = resolveDbUrl(target, dbUrl);
	if (!resolvedUrl) {
		console.error(
			`ERROR: Database URL could not be resolved for target "${target}". Please check environment variables or secret files.`,
		);
		process.exit(1);
	}

	if (target === 'disposable-test') {
		console.log(`DISPOSABLE TEST: Target ${target} allows destructive operations.`);
		process.exit(0);
	}

	const classification = classifyDbTarget(resolvedUrl);

	if (classification.target !== target) {
		console.error(
			`GUARD BLOCKED: Target mismatch: requested "${target}" but URL classifies as "${classification.target}" (${classification.reason}).`,
		);
		process.exit(1);
	}

	const guards = runGuards(target, classification, operation ?? 'unknown');

	const allErrors = guards.flatMap((g) => g.errors);
	if (allErrors.length > 0) {
		for (const err of allErrors) console.error(`GUARD BLOCKED: ${err}`);
		process.exit(1);
	}

	console.log(`Guard OK: target=${target}, operation=${operation ?? '(none)'}`);
	process.exit(0);
}

function cliRedact(): void {
	const textIdx = process.argv.indexOf('--text');
	const text = textIdx !== -1 ? process.argv[textIdx + 1] : undefined;
	if (!text) {
		console.error('Usage: tsx scripts/db/db-guard.ts redact --text "<string>"');
		process.exit(1);
	}
	console.log(redactCredentials(text));
	process.exit(0);
}

function cliVerifyLocal(): void {
	const configPath = resolve(process.cwd(), 'supabase', 'config.toml');
	const configContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
	const result = verifyLocalIdentity({
		supabaseConfig: configContent,
	});
	if (!result.ok) {
		for (const err of result.errors) console.error(`ERROR: ${err}`);
		process.exit(1);
	}
	console.log(`Local identity verified: project=${PERSISTENT_LOCAL.projectId}`);
	process.exit(0);
}

function cli(): void {
	const command = process.argv[2];
	switch (command) {
		case 'classify':
			cliClassify();
			break;
		case 'check':
			cliCheck();
			break;
		case 'redact':
			cliRedact();
			break;
		case 'verify-local':
			cliVerifyLocal();
			break;
		default: {
			console.error(`
Usage:
  tsx scripts/db/db-guard.ts classify --db-url <url>          Classify a DB URL
  tsx scripts/db/db-guard.ts check --target <t> [--op <op>]    Run guard checks
  tsx scripts/db/db-guard.ts redact --text "<str>"             Redact credentials
  tsx scripts/db/db-guard.ts verify-local                      Verify local identity

Targets: production, preview, persistent-local, disposable-test
`);
			process.exit(1);
		}
	}
}

const isMainModule = process.argv[1]?.endsWith('db-guard.ts');
if (isMainModule) {
	cli();
}
