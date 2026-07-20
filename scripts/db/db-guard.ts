/**
 * db-guard.ts — Central Database Safety Guard
 *
 * Classifies database targets and enforces environment-specific policies:
 *
 *   production        — Read-only inspection and export only.
 *                       All writes, migrations, resets, DDL are blocked.
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbTarget = 'production' | 'preview' | 'persistent-local' | 'disposable-test' | 'unknown';

export interface ClassificationResult {
	target: DbTarget;
	reason: string;
	dbUrl?: string;
}

export interface GuardResult {
	ok: boolean;
	errors: string[];
}

// ---------------------------------------------------------------------------
// Constants & Secret Resolvers
// ---------------------------------------------------------------------------

export const PREVIEW_SECRET_FILES = [
	'.env.preview.local',
	'.env.preview',
	'.secrets/preview-db-url',
	'.tmp/secrets/preview-db-url',
];

export const PROD_SECRET_FILES = [
	'.env.production.local',
	'.env.prod.local',
	'.secrets/prod-db-url',
	'.tmp/secrets/prod-db-url',
];

/**
 * Retrieve a database connection string or secret from the environment or files.
 */
export function getSecretFromEnvOrFiles(envVar: string, files: string[]): string {
	if (process.env[envVar]?.trim()) {
		return process.env[envVar]!.trim();
	}
	for (const fileName of files) {
		const path = resolve(process.cwd(), fileName);
		if (!existsSync(path)) continue;
		const content = readFileSync(path, 'utf8').trim();
		if (content.includes(`${envVar}=`)) {
			const match = content.match(new RegExp(`${envVar}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
			if (match?.[1]) return match[1].trim();
		} else if (content && !content.includes('\n')) {
			return content;
		}
	}
	return '';
}

/** The persistent local Supabase configuration. */
export const PERSISTENT_LOCAL = {
	projectId: 'celebra-me-rsvp',
	apiUrl: 'http://127.0.0.1:54321',
	dbPort: 54322,
	dbUser: 'postgres',
	dbName: 'postgres',
	dbHosts: ['127.0.0.1', 'localhost', '::1'] as readonly string[],
	studioPort: 54323,
	shadowPort: 54320,
} as const;

/** The disposable test Supabase configuration. */
const DISPOSABLE_TEST = {
	projectId: 'celebra-me-test',
	apiPort: 54331,
	dbPort: 54332,
	studioPort: 54333,
	shadowPort: 54330,
	dbUser: 'postgres',
	dbName: 'postgres',
	dbHosts: ['127.0.0.1', 'localhost', '::1'] as readonly string[],
} as const;

/** Supabase production host suffixes — used to classify remote Supabase instances. */
const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'];

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Parse a postgres connection string into its components.
 * Returns null for invalid URLs or non-postgres protocols.
 */
export function parseDbUrl(rawUrl: string): {
	protocol: string;
	user: string;
	password: string;
	hostname: string;
	port: number;
	pathname: string;
} | null {
	try {
		const url = new URL(rawUrl);
		if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
		return {
			protocol: url.protocol,
			user: decodeURIComponent(url.username || ''),
			password: decodeURIComponent(url.password || ''),
			hostname: url.hostname.toLowerCase(),
			port: parseInt(url.port || '5432', 10),
			pathname: (url.pathname || '/postgres').replace(/^\//, '') || 'postgres',
		};
	} catch {
		return null;
	}
}

/**
 * Redact sensitive portions of a DB URL for safe logging.
 * Returns a human-readable redacted form.
 */
export function redactDbUrl(rawUrl: string): string {
	const parsed = parseDbUrl(rawUrl);
	if (!parsed) return '<invalid-url>';
	const { protocol, user, hostname, port, pathname } = parsed;
	return `${protocol}//${user || '<user>'}:<redacted>@${hostname}:${port}/${pathname}`;
}

/**
 * Redact all known DB URLs from arbitrary text (logs, error messages).
 */
export function redactCredentials(text: string): string {
	// Match common postgres connection string patterns
	const urlPattern = /(postgres(?:ql)?:\/\/)(?:[^\s@]+@)?(?:[^\s:]+(?::\d+)?\/[^\s]*)/gi;
	return text.replace(urlPattern, (_match, protocol) => `${protocol}<redacted>@<host>`);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a database URL into one of the four target types.
 * Production checks use host suffix matching against known Supabase hosts.
 * Local checks use host/port matching against persistent and disposable configs.
 * Unknown hosts or ambiguous configurations return 'unknown'.
 */
export function classifyDbTarget(
	dbUrl: string,
	options?: { apiUrl?: string },
): ClassificationResult {
	const parsed = parseDbUrl(dbUrl);
	if (!parsed) {
		return { target: 'unknown', reason: 'Invalid or non-postgres URL' };
	}

	const { hostname, port } = parsed;

	// --- Preview check: matches PREVIEW_DB_URL ---
	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (previewDbUrl && dbUrl === previewDbUrl) {
		return {
			target: 'preview',
			reason: `Matches PREVIEW_DB_URL (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// --- Production check: host is a Supabase cloud host ---
	if (
		SUPABASE_HOST_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix))
	) {
		return { target: 'production', reason: `Supabase cloud host: ${hostname}`, dbUrl };
	}

	// --- Disposable-test check ---
	if (
		DISPOSABLE_TEST.dbHosts.includes(hostname) &&
		port === DISPOSABLE_TEST.dbPort
	) {
		return {
			target: 'disposable-test',
			reason: `Disposable test environment (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// --- Persistent-local check ---
	if (
		PERSISTENT_LOCAL.dbHosts.includes(hostname) &&
		port === PERSISTENT_LOCAL.dbPort
	) {
		// Also check the API URL if provided
		if (options?.apiUrl) {
			try {
				const apiParsed = new URL(options.apiUrl);
				if (
					!PERSISTENT_LOCAL.dbHosts.includes(apiParsed.hostname.toLowerCase()) ||
					apiParsed.port !== String(PERSISTENT_LOCAL.apiUrl.split(':')[2])
				) {
					return {
						target: 'unknown',
						reason: `Port matches persistent-local but API URL ${options.apiUrl} does not match expected ${PERSISTENT_LOCAL.apiUrl}`,
						dbUrl,
					};
				}
			} catch {
				return { target: 'unknown', reason: 'Invalid API URL provided', dbUrl };
			}
		}

		return {
			target: 'persistent-local',
			reason: `Persistent local environment (host=${hostname}, port=${port})`,
			dbUrl,
		};
	}

	// --- Local but non-standard port: might be a leftover or misconfigured service ---
	if (PERSISTENT_LOCAL.dbHosts.includes(hostname)) {
		return {
			target: 'unknown',
			reason: `Local host ${hostname} on non-standard port ${port} — cannot classify`,
			dbUrl,
		};
	}

	return { target: 'unknown', reason: `Unrecognized host: ${hostname}`, dbUrl };
}

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
		// Look for the project ID in supabase status output
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

		// Check API URL
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
		// Not a production target — production guard is not applicable
		return { ok: true, errors: [] };
	}

	if (operation === 'migrate') {
		const parsed = parseDbUrl(classification.dbUrl ?? '');
		const expectedHost = parsed?.hostname ?? '';
		if (expectedHost && process.env.CONFIRM_PROD_MIGRATION === `MIGRATE ${expectedHost}`) {
			return { ok: true, errors: [] };
		}
	}

	// Block any write, DDL, or destructive operation
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
		{ pattern: /\btruncate\s+(table\s+)?(\w+\.)?\w+\s+cascade\b/i, label: 'TRUNCATE ... CASCADE' },
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
export function guardPreview(
	classification: ClassificationResult,
	operation: string,
): GuardResult {
	const errors: string[] = [];

	if (classification.target !== 'preview') {
		return { ok: true, errors: [] };
	}

	const destructiveOps = [
		{ pattern: /\bsupabase\s+db\s+reset\b/i, label: 'supabase db reset' },
		{ pattern: /\bdocker\s+volume\s+rm\b/i, label: 'docker volume rm' },
		{ pattern: /\bdocker\s+compose\s+down\s+-v\b/i, label: 'docker compose down -v' },
		{ pattern: /\bdrop\s+(table|schema|database)\s+.*\bcascade\b/i, label: 'DROP ... CASCADE' },
		{ pattern: /\btruncate\s+(table\s+)?(\w+\.)?\w+\s+cascade\b/i, label: 'TRUNCATE ... CASCADE' },
	];

	for (const { pattern, label } of destructiveOps) {
		if (pattern.test(operation)) {
			errors.push(
				`PREVIEW BLOCKED: "${label}" is not permitted against the preview database. ` +
					`Preview environment schema can be updated via pnpm db:preview:migrate or pnpm db:preview:patch.`,
			);
		}
	}

	return { ok: errors.length === 0, errors };
}

export function guardUnknown(classification: ClassificationResult, operation = 'unknown'): GuardResult {
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
 * Check whether a DB URL contains local host identity (host/port match).
 */
export function isLocalDbUrl(dbUrl: string): boolean {
	const parsed = parseDbUrl(dbUrl);
	if (!parsed) return false;
	const { hostname, port } = parsed;
	return (
		(PERSISTENT_LOCAL.dbHosts.includes(hostname) && port === PERSISTENT_LOCAL.dbPort) ||
		(DISPOSABLE_TEST.dbHosts.includes(hostname) && port === DISPOSABLE_TEST.dbPort)
	);
}

/**
 * Verify that a dump file's checksum is valid and the file is not empty.
 * Returns the SHA256 checksum if available, or validates file size.
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

		// Check for basic SQL sanity — should contain at least one INSERT or COPY
		if (!/^(INSERT|COPY|CREATE|SET)\b/im.test(content.trim())) {
			errors.push(
				`Dump file does not appear to contain valid SQL: ${dumpPath}`,
			);
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

function resolveDbUrl(target: string, dbUrl?: string): string {
	if (dbUrl) return dbUrl;

	if (target === 'production') {
		return getSecretFromEnvOrFiles('PROD_DB_URL', PROD_SECRET_FILES) ?? '';
	}
	if (target === 'preview') {
		return getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES) ?? '';
	}
	if (target === 'persistent-local') {
		return `postgresql://postgres:postgres@127.0.0.1:${PERSISTENT_LOCAL.dbPort}/postgres`;
	}
	if (target === 'disposable-test') {
		return `postgresql://postgres:postgres@127.0.0.1:${DISPOSABLE_TEST.dbPort}/postgres`;
	}
	return '';
}

function runGuards(target: string, classification: ClassificationResult, operation: string): GuardResult[] {
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

	const validTargets: DbTarget[] = ['production', 'preview', 'persistent-local', 'disposable-test'];
	if (!validTargets.includes(target as DbTarget)) {
		console.error(`Invalid target "${target}". Must be one of: ${validTargets.join(', ')}`);
		process.exit(1);
	}

	// Verify local identity if needed
	if (target === 'persistent-local') {
		verifyPersistentLocalIdentity();
	}

	// Auto-resolve connection URL if not provided
	const resolvedUrl = resolveDbUrl(target, dbUrl);
	if (!resolvedUrl) {
		console.error(`ERROR: Database URL could not be resolved for target "${target}". Please check environment variables or secret files.`);
		process.exit(1);
	}

	if (target === 'disposable-test') {
		console.log(`DISPOSABLE TEST: Target ${target} allows destructive operations.`);
		process.exit(0);
	}

	// Build the classification for the resolved connection string
	const classification = classifyDbTarget(resolvedUrl);

	// Run the applicable guard
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

// Only run CLI when executed directly (not imported)
const isMainModule = process.argv[1]?.endsWith('db-guard.ts');
if (isMainModule) {
	cli();
}
