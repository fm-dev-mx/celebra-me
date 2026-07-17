export type SqlManifest = Record<string, string>;

export interface LintResult {
	ok: boolean;
	errors: string[];
	manifest: SqlManifest;
}

const REQUIRED_PROD_PATCH_FIELDS = [
	'script-id',
	'purpose',
	'env',
	'ticket',
	'tables',
	'operation',
	'expected-rows-min',
	'expected-rows-max',
	'requires-backup',
	'dry-run-query',
	'rollback',
] as const;

const BLOCKED_PATTERNS: Array<[RegExp, string]> = [
	[/\btruncate\b/i, 'TRUNCATE is blocked for production patches.'],
	[
		/\bdrop\s+(table|schema|database)\b/i,
		'DROP TABLE/SCHEMA/DATABASE is blocked for production patches.',
	],
	[/\balter\s+table\b/i, 'ALTER TABLE belongs in reviewed migrations, not production patches.'],
	[
		/\bcreate\s+policy\b|\bdrop\s+policy\b|\balter\s+policy\b/i,
		'RLS policy changes belong in reviewed migrations.',
	],
	[/\bsecurity\s+definer\b/i, 'SECURITY DEFINER changes belong in reviewed migrations.'],
	[/\bcascade\b/i, 'CASCADE is blocked for production patches.'],
];

export function argValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

export function parseSqlManifest(sql: string): SqlManifest {
	const manifest: SqlManifest = {};
	for (const line of sql.split(/\r?\n/)) {
		const match = line.match(/^\s*--\s*@([a-z0-9-]+):\s*(.*?)\s*$/i);
		if (!match) continue;
		const key = match[1]?.toLowerCase();
		const value = match[2]?.trim();
		if (key && value !== undefined) manifest[key] = value;
	}
	return manifest;
}

export function validateProductionPatchManifest(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	for (const field of REQUIRED_PROD_PATCH_FIELDS) {
		if (!manifest[field]) errors.push(`Missing required manifest field: @${field}`);
	}

	if (manifest.env && manifest.env !== 'production') {
		errors.push('@env must be "production" for this entrypoint.');
	}
	if (manifest['requires-backup'] && manifest['requires-backup'].toLowerCase() !== 'true') {
		errors.push('@requires-backup must be "true" for production patches.');
	}

	for (const field of ['expected-rows-min', 'expected-rows-max'] as const) {
		const value = manifest[field];
		if (value && !/^\d+$/.test(value)) errors.push(`@${field} must be a non-negative integer.`);
	}

	return errors;
}

function stripSqlComments(sql: string): string {
	return sql
		.split(/\r?\n/)
		.map((line) => line.replace(/--.*$/, ''))
		.join('\n');
}

function splitStatements(sql: string): string[] {
	const clean = stripSqlComments(sql)
		.split(';')
		.map((statement) => statement.trim())
		.filter(Boolean);

	const result: string[] = [];
	let buffer = '';
	let depth = 0;

	for (const part of clean) {
		const dollarOpens = (part.match(/\$\$/g) || []).length;
		if (dollarOpens % 2 !== 0) depth += dollarOpens;

		if (depth > 0) {
			buffer += (buffer ? ';' : '') + part;
			if (depth === 0) {
				result.push(buffer);
				buffer = '';
			}
		} else {
			result.push(part);
		}
	}

	if (buffer) result.push(buffer);

	return depth === 0 ? result : result.concat(buffer ? [buffer] : []);
}

function statementHasWhere(statement: string): boolean {
	return /\bwhere\b/i.test(statement);
}

function checkBlockedPatterns(sql: string, blockedPatterns: Array<[RegExp, string]>): string[] {
	const errors: string[] = [];
	for (const [pattern, message] of blockedPatterns) {
		if (pattern.test(sql)) errors.push(message);
	}
	return errors;
}

function checkWhereClauses(sql: string): string[] {
	const errors: string[] = [];
	for (const statement of splitStatements(sql)) {
		if (/^update\b/i.test(statement) && !statementHasWhere(statement)) {
			errors.push('UPDATE statements must include a WHERE clause.');
		}
		if (/^delete\s+from\b/i.test(statement) && !statementHasWhere(statement)) {
			errors.push('DELETE statements must include a WHERE clause.');
		}
	}
	return errors;
}

export function lintProductionPatchSql(sql: string): LintResult {
	const manifest = parseSqlManifest(sql);
	const errors = validateProductionPatchManifest(manifest);
	const sqlWithoutComments = stripSqlComments(sql);

	errors.push(...checkBlockedPatterns(sqlWithoutComments, BLOCKED_PATTERNS));
	errors.push(...checkWhereClauses(sql));

	return { ok: errors.length === 0, errors, manifest };
}

/**
 * Validate and normalize a SUPABASE_URL for production patch execution.
 * Returns the normalized URL (no trailing slash) on success.
 * Throws an Error with a user-facing message on validation failure.
 */
export function validateAndNormalizeSupabaseUrl(rawUrl: string): string {
	if (!rawUrl) {
		throw new Error('SUPABASE_URL environment variable is required for --apply.');
	}

	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error('SUPABASE_URL is not a valid URL.');
	}

	if (url.protocol !== 'https:') {
		throw new Error('SUPABASE_URL must use HTTPS protocol.');
	}
	if (url.username || url.password) {
		throw new Error('SUPABASE_URL must not contain credentials.');
	}
	if (url.search || url.hash) {
		throw new Error('SUPABASE_URL must not contain query string or fragment.');
	}
	if (!url.hostname.endsWith('.supabase.co')) {
		throw new Error(
			'SUPABASE_URL hostname must be a Supabase project (.supabase.co).',
		);
	}

	return rawUrl.replace(/\/+$/, '');
}

/**
 * Validate that a value is a non-empty UUID string.
 * Returns the validated UUID on success.
 * Throws an Error with a user-facing message on validation failure.
 */
export function validateOwnerUserId(raw: string | undefined): string {
	if (!raw || raw.trim() === '') {
		throw new Error(
			'--owner-user-id is required. Supply the production UUID of the customer who will own this invitation.',
		);
	}
	const trimmed = raw.trim();
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
		throw new Error(
			`--owner-user-id "${trimmed}" is not a valid UUID. Expected format: 00000000-0000-0000-0000-000000000000`,
		);
	}
	return trimmed;
}

/**
 * Validate that SUPABASE_URL and PROD_DB_URL point to the same Supabase
 * project. Throws on mismatch or when the project reference cannot be
 * extracted unambiguously.
 *
 * Supported PROD_DB_URL formats:
 *   Direct:      postgresql://user:pass@db.<ref>.supabase.co:5432/postgres
 *   Direct (no prefix):
 *                postgresql://user:pass@<ref>.supabase.co:5432/postgres
 *   Pooler:      postgresql://<ref>.<region>:pass@<region>.pooler.supabase.com:6543/postgres
 *   Pooler (host prefix):
 *                postgresql://user:pass@postgres.<ref>.pooler.supabase.com:5432/postgres
 *
 * The project reference is extracted from:
 *   - SUPABASE_URL: hostname (<ref>.supabase.co)
 *   - PROD_DB_URL:  hostname OR username depending on format
 */
export function assertSameSupabaseProject(
	supabaseUrl: string,
	prodDbUrl: string,
): void {
	try {
		const supParsed = new URL(supabaseUrl);
		const dbParsed = new URL(prodDbUrl);

		const supRef = extractProjectRef(supParsed.hostname);
		if (!supRef) {
			throw new Error(
				`Cannot extract Supabase project reference from SUPABASE_URL hostname "${supParsed.hostname}".`,
			);
		}

		// Try hostname-based extraction first
		let dbRef = extractProjectRef(dbParsed.hostname);
		if (!dbRef) {
			// For pooler URLs the project reference is in the username:
			//   <ref>.<region>  or  <ref>.<region>:<role>
			const username = dbParsed.username;
			if (username) {
				dbRef = username.split('.')[0];
			}
		}
		if (!dbRef) {
			throw new Error(
				`Cannot extract Supabase project reference from PROD_DB_URL. The connection string format is unsupported or ambiguous.`,
			);
		}

		if (supRef.toLowerCase() !== dbRef.toLowerCase()) {
			throw new Error(
				`SUPABASE_URL (project "${supRef}") and PROD_DB_URL (project "${dbRef}") must reference the same Supabase project.`,
			);
		}
	} catch (error: unknown) {
		if (error instanceof Error && error.message.includes('SUPABASE_URL')) {
			throw error;
		}
		if (error instanceof TypeError || (error instanceof Error && /invalid url/i.test(error.message))) {
			throw new Error(
				'PROD_DB_URL is not a valid URL. Cannot verify project consistency.',
				{ cause: error },
			);
		}
		throw error;
	}
}

/**
 * Extract the Supabase project reference from a hostname.
 * Returns the ref or null if the hostname is not a known Supabase format.
 *
 * Supported hostname patterns:
 *   <ref>.supabase.co
 *   db.<ref>.supabase.co
 *   postgres.<ref>.pooler.supabase.com
 *   <region>.pooler.supabase.com  (ref is NOT in hostname — returns null)
 */
function extractProjectRef(hostname: string): string | null {
	const lower = hostname.toLowerCase();
	if (lower.endsWith('.supabase.co')) {
		// Remove .supabase.co suffix and optional db. prefix
		const noSuffix = lower.replace(/\.supabase\.co$/, '');
		return noSuffix.replace(/^db\./i, '').replace(/^postgres\./i, '');
	}
	if (lower.endsWith('.pooler.supabase.com')) {
		// Remove .pooler.supabase.com suffix
		const noSuffix = lower.replace(/\.pooler\.supabase\.com$/, '');
		// Check for postgres.<ref> prefix
		if (/^postgres\./i.test(noSuffix)) {
			return noSuffix.replace(/^postgres\./i, '');
		}
		// Otherwise it's <region> — ref is in the username, not hostname
		return null;
	}
	return null;
}
