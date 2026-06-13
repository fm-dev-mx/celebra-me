import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export const PROJECT_ROOT = process.cwd();
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
export const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const STORAGE_BUCKET_SIZE_LIMIT = 10_485_760;
export const REQUIRED_LOCAL_SUPER_ADMIN_EMAIL = 'celebra.me.com@gmail.com';
export const PSQL_REQUIRED_MESSAGE =
	'psql is required for local DB workflow scripts. Install PostgreSQL client tools and make sure `psql` is available on PATH. Verify with `psql --version`.';
export const PROD_SECRET_FILES = [
	'.env.production.local',
	'.env.prod.local',
	'.secrets/prod-db-url',
	'.tmp/secrets/prod-db-url',
];

export interface CommandResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

interface RunOptions {
	env?: NodeJS.ProcessEnv;
	input?: string;
	inherit?: boolean;
	redact?: string[];
	throwOnError?: boolean;
}

export function log(...args: unknown[]): void {
	console.log(...args);
}

export function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function parseTsv(output: string): string[][] {
	return output
		.trim()
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => line.split('\t'));
}

export function fail(message: string): never {
	console.error(`ERROR: ${message}`);
	process.exit(1);
}

export function ensureDir(path: string): void {
	mkdirSync(path, { recursive: true });
}

export function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

export function parseEnvContent(content: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const separator = line.indexOf('=');
		if (separator <= 0) continue;
		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		const inlineComment = value.match(/^(.*?)(\s+#.*)$/);
		if (inlineComment) value = inlineComment[1]?.trim() ?? value;
		parsed[key] = value;
	}
	return parsed;
}

export function loadAppEnv(): Record<string, string> {
	const merged: Record<string, string> = {};
	for (const fileName of ['.env.local', '.env']) {
		const path = resolve(PROJECT_ROOT, fileName);
		if (!existsSync(path)) continue;
		const parsed = parseEnvContent(readFileSync(path, 'utf8'));
		for (const [key, value] of Object.entries(parsed)) {
			if (merged[key] === undefined) merged[key] = value;
		}
	}
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) merged[key] = value;
	}
	return merged;
}

function readSecretFile(path: string): string {
	const content = readFileSync(path, 'utf8').trim();
	if (content.includes('PROD_DB_URL=')) {
		return parseEnvContent(content).PROD_DB_URL ?? '';
	}
	return content;
}

export function getProdDbUrl(): { url: string; source: string } {
	if (process.env.PROD_DB_URL?.trim()) {
		return { url: process.env.PROD_DB_URL.trim(), source: 'environment variable PROD_DB_URL' };
	}

	for (const fileName of PROD_SECRET_FILES) {
		const path = resolve(PROJECT_ROOT, fileName);
		if (!existsSync(path)) continue;
		const url = readSecretFile(path).trim();
		if (url) return { url, source: fileName };
	}

	fail(
		`PROD_DB_URL is required. Set it in the shell or one of these gitignored files: ${PROD_SECRET_FILES.join(
			', ',
		)}.`,
	);
}

export function parseDbUrl(rawUrl: string): URL {
	try {
		const url = new URL(rawUrl);
		if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
			fail('PROD_DB_URL must be a postgres/postgresql connection string.');
		}
		return url;
	} catch {
		fail('PROD_DB_URL is not a valid URL.');
	}
}

export function redactDbUrl(rawUrl: string): string {
	const url = parseDbUrl(rawUrl);
	return `${url.protocol}//${url.username || '<user>'}:<redacted>@${url.hostname}${
		url.port ? `:${url.port}` : ''
	}${url.pathname || '/postgres'}`;
}

export function assertProductionDbUrl(rawUrl: string): URL {
	const url = parseDbUrl(rawUrl);
	const host = url.hostname.toLowerCase();
	const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
	const isSupabaseHost =
		host === 'supabase.co' ||
		host.endsWith('.supabase.co') ||
		host === 'supabase.com' ||
		host.endsWith('.supabase.com');

	if (isLocal || !isSupabaseHost) {
		fail(
			`Refusing PROD_DB_URL because host is not a Supabase production host. Redacted target: ${redactDbUrl(
				rawUrl,
			)}`,
		);
	}
	return url;
}

export function isLocalSupabaseUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return ['localhost', '127.0.0.1', '::1'].includes(host);
	} catch {
		return false;
	}
}

export function assertAppEnvIsLocal(appEnv = loadAppEnv()): void {
	const supabaseUrl = appEnv.SUPABASE_URL;
	const publicSupabaseUrl = appEnv.PUBLIC_SUPABASE_URL;
	if (supabaseUrl !== LOCAL_SUPABASE_URL || publicSupabaseUrl !== LOCAL_SUPABASE_URL) {
		fail(
			`Local DB workflow requires SUPABASE_URL and PUBLIC_SUPABASE_URL to be ${LOCAL_SUPABASE_URL}.`,
		);
	}
}

export function getFirstSuperAdminEmail(appEnv = loadAppEnv()): string {
	return (appEnv.SUPER_ADMIN_EMAILS ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
}

export function getLocalSuperAdminPassword(appEnv = loadAppEnv()): string {
	return appEnv.LOCAL_SUPER_ADMIN_PASSWORD || appEnv.RSVP_ADMIN_PASSWORD || '';
}

export function requireLocalSuperAdminConfig(appEnv = loadAppEnv()): {
	email: string;
	password: string;
} {
	const email = getFirstSuperAdminEmail(appEnv);
	if (email !== REQUIRED_LOCAL_SUPER_ADMIN_EMAIL) {
		fail(
			`Local admin bootstrap requires the first SUPER_ADMIN_EMAILS entry to be ${REQUIRED_LOCAL_SUPER_ADMIN_EMAIL}; got ${email || '<unset>'}.`,
		);
	}

	const password = getLocalSuperAdminPassword(appEnv);
	if (!password) {
		fail(
			'Local admin bootstrap requires LOCAL_SUPER_ADMIN_PASSWORD or RSVP_ADMIN_PASSWORD to be configured.',
		);
	}

	return { email, password };
}

export function assertNoProdCredentialsInLocalEnv(): void {
	const localEnvPath = resolve(PROJECT_ROOT, '.env.local');
	if (!existsSync(localEnvPath)) return;
	const parsed = parseEnvContent(readFileSync(localEnvPath, 'utf8'));
	const values = [parsed.PROD_DB_URL, parsed.SUPABASE_URL, parsed.PUBLIC_SUPABASE_URL].filter(
		Boolean,
	);
	const unsafe = values.some((value) => {
		try {
			const host = new URL(value as string).hostname.toLowerCase();
			return host.endsWith('.supabase.co') || host.endsWith('.supabase.com');
		} catch {
			return false;
		}
	});
	if (unsafe) {
		fail(
			'Refusing to run because .env.local appears to contain production Supabase credentials.',
		);
	}
}

export function runCommand(
	command: string,
	args: string[],
	options: RunOptions = {},
): CommandResult {
	const { throwOnError = true } = options;
	const spawnOptions: SpawnSyncOptions = {
		cwd: PROJECT_ROOT,
		env: { ...process.env, ...options.env },
		input: options.input,
		encoding: 'utf8',
		stdio: options.inherit ? 'inherit' : 'pipe',
	};
	const result = spawnSync(command, args, spawnOptions);
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr =
		typeof result.stderr === 'string' ? result.stderr : (result.error?.message ?? '');
	const status = result.status;

	if (throwOnError) {
		if (result.error) {
			fail(`Failed to start ${command}: ${result.error.message}`);
		}
		if (status !== 0) {
			const details = sanitizeOutput(
				[stdout, stderr].filter(Boolean).join('\n'),
				options.redact,
			);
			fail(`${command} ${args[0] ?? ''} failed.${details ? `\n${details}` : ''}`);
		}
	}

	return { status, stdout, stderr };
}

export function tryRunCommand(
	command: string,
	args: string[],
	options: RunOptions = {},
): CommandResult {
	return runCommand(command, args, { ...options, throwOnError: false });
}

function sanitizeOutput(outputText: string, secrets: string[] = []): string {
	let next = outputText;
	for (const secret of secrets) {
		if (!secret) continue;
		next = next.split(secret).join('<redacted>');
	}
	return next.trim();
}

export function runPsql(sql: string, dbUrl = LOCAL_DB_URL, redact: string[] = []): CommandResult {
	return runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-align',
			'--tuples-only',
			'--field-separator',
			'\t',
			'--dbname',
			dbUrl,
		],
		{
			input: sql,
			redact: [dbUrl, ...redact],
		},
	);
}

export function runPsqlFile(filePath: string, dbUrl = LOCAL_DB_URL): CommandResult {
	return runCommand('psql', ['--set', 'ON_ERROR_STOP=1', '--dbname', dbUrl, '--file', filePath], {
		redact: [dbUrl],
	});
}

export function assertLocalDbReachable(): void {
	const psqlResult = tryRunCommand('psql', ['--version']);
	if (psqlResult.status !== 0) {
		fail(PSQL_REQUIRED_MESSAGE);
	}

	const result = tryRunCommand('psql', [
		'--set',
		'ON_ERROR_STOP=1',
		'--dbname',
		LOCAL_DB_URL,
		'--command',
		'select 1;',
	]);
	if (result.status !== 0) {
		fail(
			`Local Supabase database is not reachable. Run \`supabase start\` first. If Supabase is already running, verify local access with \`psql --version\` and a direct psql connection.`,
		);
	}
}

export function assertLocalApiReachable(): void {
	const result = tryRunCommand('supabase', ['status']);
	if (result.status !== 0) {
		fail(
			'Local Supabase is not running or Supabase CLI is unavailable. Run `supabase start` first.',
		);
	}
}

export function writeTextFile(path: string, content: string): void {
	ensureDir(dirname(path));
	writeFileSync(path, content, 'utf8');
}

/**
 * Wraps a string as a SQL string literal with single-quote escaping.
 *
 * ONLY for SQL **values** (e.g. `WHERE email = ${sqlLiteral(addr)}`).
 * NEVER use for identifiers (table/column names) — use `%I` with `format()` instead.
 *
 * Handles: embedded single quotes (`'` → `''`), newlines, unicode, backslashes.
 */
export function sqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function validateAuthOrphans(): void {
	runPsql(`
do $$
declare
  orphan_count integer;
begin
  select count(*) into orphan_count
  from public.events e
  left join auth.users u on u.id = e.owner_user_id
  where u.id is null;
  if orphan_count <> 0 then
    raise exception 'events.owner_user_id has % auth orphan(s)', orphan_count;
  end if;

  select count(*) into orphan_count
  from public.invitations i
  left join auth.users u on u.id = i.created_by
  where i.created_by is not null and u.id is null;
  if orphan_count <> 0 then
    raise exception 'invitations.created_by has % auth orphan(s)', orphan_count;
  end if;

  select count(*) into orphan_count
  from public.app_user_roles r
  left join auth.users u on u.id = r.user_id
  where u.id is null;
  if orphan_count <> 0 then
    raise exception 'app_user_roles has % auth orphan(s)', orphan_count;
  end if;

  select count(*) into orphan_count
  from public.event_memberships m
  left join auth.users u on u.id = m.user_id
  where u.id is null;
  if orphan_count <> 0 then
    raise exception 'event_memberships has % auth orphan(s)', orphan_count;
  end if;
end $$;
`);
}

export function createProdBackup(prodDbUrl: string, outputPath: string, schemaOnly: boolean): void {
	ensureDir(dirname(outputPath));
	const args = ['db', 'dump', '--db-url', prodDbUrl, '--schema', 'public', '-f', outputPath];
	if (schemaOnly) {
		args.splice(4, 0, '--schema-only');
	} else {
		args.splice(4, 0, '--data-only', '--use-copy');
	}
	runCommand('supabase', args, { redact: [prodDbUrl] });
}

export const REFRESH_PARITY_TABLES = [
	'invitations',
	'events',
	'published_invitation_content',
	'guest_invitations',
	'invitation_content_drafts',
	'intake_requests',
	'intake_submissions',
	'app_user_roles',
	'event_memberships',
	'event_claim_codes',
] as const;

export type ParityTable = (typeof REFRESH_PARITY_TABLES)[number];

export function getMissingTables(
	expected: readonly string[],
	existing: readonly string[],
): string[] {
	return expected.filter((t) => !existing.includes(t));
}

export function ensureTablesExist(
	tables: readonly string[],
	schema: string,
	dbUrl = LOCAL_DB_URL,
	label = 'target',
): void {
	const tableList = tables.map((t) => sqlLiteral(t)).join(', ');
	const sql = `select table_name
from information_schema.tables
where table_schema = ${sqlLiteral(schema)}
  and table_type = 'BASE TABLE'
  and table_name = any(array[${tableList}])
order by table_name;`;
	const result = runPsql(sql, dbUrl);
	const existing = result.stdout.trim().split(/\r?\n/).filter(Boolean);
	const missing = getMissingTables(tables, existing);
	if (missing.length > 0) {
		const detail = missing.map((t) => `  - ${t}`).join('\n');
		throw new Error(
			`Refresh parity table(s) not found in schema "${schema}" (${label}):\n${detail}`,
		);
	}
}

export interface ParityFailure {
	table: string;
	sourceCount: number;
	targetCount: number;
	reason: 'count_mismatch';
}

export interface ParityResult {
	ok: boolean;
	failures: ParityFailure[];
}

export interface ValidateRefreshParityParams {
	sourceCounts: Record<string, number>;
	targetCounts: Record<string, number>;
	/**
	 * Per-table maximum allowed extra rows in the target (local) database.
	 * Example: `{ app_user_roles: 1 }` allows local to have up to 1 more row
	 * than production (e.g. a local super-admin that does not exist in prod).
	 * A negative delta (target < source) always fails regardless of maxDelta.
	 * Use `Infinity` to fully ignore a table's count.
	 */
	maxDeltas?: Record<string, number>;
}

export function validateRefreshParity(params: ValidateRefreshParityParams): ParityResult {
	const failures: ParityFailure[] = [];
	const allTables = [
		...new Set([...Object.keys(params.sourceCounts), ...Object.keys(params.targetCounts)]),
	];

	for (const table of allTables) {
		const sourceCount = params.sourceCounts[table] ?? 0;
		const targetCount = params.targetCounts[table] ?? 0;

		if (sourceCount !== targetCount) {
			const maxDelta = params.maxDeltas?.[table] ?? 0;
			const delta = targetCount - sourceCount;
			if (delta < 0 || delta > maxDelta) {
				failures.push({
					table,
					sourceCount,
					targetCount,
					reason: 'count_mismatch',
				});
			}
		}
	}

	return { ok: failures.length === 0, failures };
}

const COPY_HEADER_RE = /^COPY\s+(?:"?public"?\.)?"?[a-z_]\w*"?\s*\(/i;
const COPY_TERMINATOR_RE = /^\s*\\.\s*$/;

function transformSchemaRef(line: string, schema: string): string {
	return line
		.replace(/"public"\./g, `"${schema}".`)
		.replace(/\bpublic\./g, `${schema}.`)
		.replace(/SET\s+search_path\s*=\s*"?public"?\s*,/gi, `SET search_path = ${schema},`);
}

export function transformDumpForStaging(input: string, schema: string): string {
	const lines = input.split(/\r?\n/);
	const result: string[] = [];
	let insideCopyData = false;

	for (const line of lines) {
		if (!insideCopyData && COPY_HEADER_RE.test(line)) {
			result.push(transformSchemaRef(line, schema));
			insideCopyData = true;
		} else if (insideCopyData && COPY_TERMINATOR_RE.test(line)) {
			result.push(line);
			insideCopyData = false;
		} else if (!insideCopyData) {
			result.push(transformSchemaRef(line, schema));
		} else {
			result.push(line);
		}
	}

	return result.join('\n');
}

export function countTableRows(
	tables: readonly string[],
	schema: string,
	dbUrl = LOCAL_DB_URL,
): Record<string, number> {
	const unions = tables
		.map(
			(t, i) =>
				`select ${i} as idx, ${sqlLiteral(t)} as tbl, count(*) as cnt from ${schema}."${t}"`,
		)
		.join(' union all ');

	const sql = `select tbl, cnt from (${unions}) sub order by idx;`;
	const result = runPsql(sql, dbUrl);

	const counts: Record<string, number> = {};
	for (const line of result.stdout.trim().split(/\r?\n/)) {
		if (!line.trim()) continue;
		const [table, countStr] = line.split('\t');
		const n = parseInt(countStr ?? '0', 10);
		if (isNaN(n))
			throw new Error(
				`countTableRows: non-numeric count for table "${table ?? '<unknown>'}": ${countStr}`,
			);
		counts[table ?? ''] = n;
	}
	return counts;
}

export async function requireProductionConfirmation(targetHost: string): Promise<void> {
	if (process.env.CONFIRM_PROD_MIGRATION === `MIGRATE ${targetHost}`) return;

	const rl = createInterface({ input, output });
	try {
		const answer = await rl.question(
			`Type "MIGRATE ${targetHost}" to apply reviewed migrations to production: `,
		);
		if (answer.trim() !== `MIGRATE ${targetHost}`) {
			fail(
				'Production migration confirmation did not match. No production changes were made.',
			);
		}
	} finally {
		rl.close();
	}
}
