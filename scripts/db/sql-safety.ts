export type SqlManifest = Record<string, string>;

export interface LintResult {
	ok: boolean;
	errors: string[];
	manifest: SqlManifest;
}

interface ParsedSqlStatement {
	inspection: string;
	dollarBodies: string[];
}

interface ParsedBlockComment {
	inspection: string;
	nextIndex: number;
}

interface ParsedDollarBlock {
	body: string;
	nextIndex: number;
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
		/\bdrop\s+(table|schema|database|index|function|procedure|routine|view|materialized\s+view|type|domain|sequence|extension|trigger|role)\b/i,
		'Persistent DROP belongs in reviewed migrations, not production patches.',
	],
	[
		/\balter\s+(table|index|function|procedure|routine|schema|view|materialized\s+view|type|domain|sequence|database|role)\b/i,
		'Schema-changing ALTER belongs in reviewed migrations, not production patches.',
	],
	[
		/\bcreate\s+(?!temp(?:orary)?\s+)(?:unlogged\s+)?table\b/i,
		'Persistent CREATE TABLE belongs in reviewed migrations, not production patches.',
	],
	[
		/\bcreate\s+(unique\s+)?index\b/i,
		'CREATE INDEX belongs in reviewed migrations, not production patches.',
	],
	[
		/\bcreate\s+(or\s+replace\s+)?(function|procedure|routine)\b/i,
		'Persistent routine creation belongs in reviewed migrations, not production patches.',
	],
	[
		/\bcreate\s+(or\s+replace\s+)?(view|materialized\s+view|type|domain|sequence|extension|trigger)\b/i,
		'Persistent schema object creation belongs in reviewed migrations, not production patches.',
	],
	[/\b(grant|revoke)\b/i, 'GRANT/REVOKE belongs in reviewed migrations, not production patches.'],
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

function validateRequiredManifestFields(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	for (const field of REQUIRED_PROD_PATCH_FIELDS) {
		if (!manifest[field]) errors.push(`Missing required manifest field: @${field}`);
	}
	return errors;
}

function validateManifestEnvironment(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	if (manifest.env && manifest.env !== 'production') {
		errors.push('@env must be "production" for this entrypoint.');
	}
	if (manifest['requires-backup'] && manifest['requires-backup'].toLowerCase() !== 'true') {
		errors.push('@requires-backup must be "true" for production patches.');
	}
	return errors;
}

function validateManifestExpectedRows(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	for (const field of ['expected-rows-min', 'expected-rows-max'] as const) {
		const value = manifest[field];
		if (value && !/^\d+$/.test(value)) errors.push(`@${field} must be a non-negative integer.`);
	}

	const min = manifest['expected-rows-min'];
	const max = manifest['expected-rows-max'];
	if (min && max && /^\d+$/.test(min) && /^\d+$/.test(max) && BigInt(min) > BigInt(max)) {
		errors.push('@expected-rows-min must be less than or equal to @expected-rows-max.');
	}
	return errors;
}

function validateManifestOperation(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	const operation = manifest.operation?.toLowerCase();
	if (operation && !['update', 'insert', 'delete', 'select-only'].includes(operation)) {
		errors.push('@operation must be one of UPDATE, INSERT, DELETE, or SELECT-ONLY.');
	}
	return errors;
}

function validateManifestTables(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	const tables = manifest.tables;
	if (tables) {
		const entries = tables
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
		if (
			entries.length === 0 ||
			entries.some((table) => !/^public\.[a-z_][a-z0-9_]*$/i.test(table)) ||
			new Set(entries.map((table) => table.toLowerCase())).size !== entries.length
		) {
			errors.push(
				'@tables must be a unique comma-separated list of public.<table> identifiers.',
			);
		}
	}
	return errors;
}

function validateManifestPreview(manifest: SqlManifest): string[] {
	const errors: string[] = [];
	const preview = manifest['dry-run-query'];
	const pairedStores = manifest['paired-stores'];
	const pairKey = manifest['pair-key'];
	if (Boolean(pairedStores) !== Boolean(pairKey)) {
		errors.push('@paired-stores and @pair-key must be declared together.');
	}
	for (const [field, value] of [
		['paired-stores', pairedStores],
		['pair-key', pairKey],
	] as const) {
		if (
			value &&
			value
				.split(',')
				.map((entry) => entry.trim())
				.some((entry) => !/^[a-z][a-z0-9_]*$/i.test(entry))
		) {
			errors.push(`@${field} must contain comma-separated SQL identifiers.`);
		}
	}
	if (pairedStores && new Set(pairedStores.split(',').map((entry) => entry.trim())).size < 2) {
		errors.push('@paired-stores must contain at least two distinct stores.');
	}
	if (preview) {
		if (/;/.test(preview) || !/^\s*(?:select\b|with\b[\s\S]+\bselect\b)/i.test(preview)) {
			errors.push('@dry-run-query must be one read-only SELECT query without a semicolon.');
		}
		if (
			/\b(?:insert|update|delete|merge|call|do|copy|create|alter|drop|truncate)\b/i.test(
				preview,
			)
		) {
			errors.push('@dry-run-query must not contain a mutating or procedural statement.');
		}
	}
	return errors;
}

export function validateProductionPatchManifest(manifest: SqlManifest): string[] {
	return [
		...validateRequiredManifestFields(manifest),
		...validateManifestEnvironment(manifest),
		...validateManifestExpectedRows(manifest),
		...validateManifestOperation(manifest),
		...validateManifestTables(manifest),
		...validateManifestPreview(manifest),
	];
}

function consumeLineComment(sql: string, index: number): number {
	let nextIndex = index + 2;
	while (nextIndex < sql.length && sql[nextIndex] !== '\n') nextIndex += 1;
	return nextIndex;
}

function consumeBlockComment(sql: string, index: number): ParsedBlockComment {
	let depth = 1;
	let inspection = '';
	let nextIndex = index + 2;
	while (nextIndex < sql.length && depth > 0) {
		if (sql[nextIndex] === '/' && sql[nextIndex + 1] === '*') {
			depth += 1;
			nextIndex += 2;
			continue;
		}
		if (sql[nextIndex] === '*' && sql[nextIndex + 1] === '/') {
			depth -= 1;
			nextIndex += 2;
			continue;
		}
		inspection += sql[nextIndex] === '\n' ? '\n' : ' ';
		nextIndex += 1;
	}
	if (depth !== 0) throw new Error('Unclosed block comment.');
	return { inspection, nextIndex };
}

function parseDollarBlock(sql: string, index: number): ParsedDollarBlock | null {
	const tag = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
	if (!tag) return null;
	const bodyStart = index + tag.length;
	const bodyEnd = sql.indexOf(tag, bodyStart);
	if (bodyEnd === -1) throw new Error(`Unclosed dollar-quoted block ${tag}.`);
	return { body: sql.slice(bodyStart, bodyEnd), nextIndex: bodyEnd + tag.length };
}

function parseProductionPatchStatements(sql: string): ParsedSqlStatement[] {
	const statements: ParsedSqlStatement[] = [];
	let inspection = '';
	let dollarBodies: string[] = [];
	let index = 0;

	const appendMaskedQuoted = (quote: "'" | '"'): void => {
		inspection += quote;
		index += 1;
		while (index < sql.length) {
			const char = sql[index];
			if (char === '\\' && index + 1 < sql.length) {
				inspection += '  ';
				index += 2;
				continue;
			}
			if (char === quote) {
				if (sql[index + 1] === quote) {
					inspection += '  ';
					index += 2;
					continue;
				}
				inspection += quote;
				index += 1;
				return;
			}
			inspection += char === '\n' ? '\n' : ' ';
			index += 1;
		}
		throw new Error(
			`Unclosed ${quote === "'" ? 'single-quoted string' : 'quoted identifier'}.`,
		);
	};

	const finishStatement = (): void => {
		const normalized = inspection.trim();
		if (normalized) statements.push({ inspection: normalized, dollarBodies });
		inspection = '';
		dollarBodies = [];
	};

	while (index < sql.length) {
		const char = sql[index];
		const next = sql[index + 1];
		if (char === '-' && next === '-') {
			index = consumeLineComment(sql, index);
			inspection += ' ';
			continue;
		}
		if (char === '/' && next === '*') {
			const comment = consumeBlockComment(sql, index);
			index = comment.nextIndex;
			inspection += comment.inspection;
			inspection += ' ';
			continue;
		}
		if (char === "'" || char === '"') {
			appendMaskedQuoted(char);
			continue;
		}
		if (char === '$') {
			const block = parseDollarBlock(sql, index);
			if (block) {
				dollarBodies.push(block.body);
				inspection += '$body$';
				index = block.nextIndex;
				continue;
			}
		}
		if (char === ';') {
			finishStatement();
			index += 1;
			continue;
		}
		inspection += char;
		index += 1;
	}
	finishStatement();
	return statements;
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

type MutationVerb = 'update' | 'insert' | 'delete';

function mutationVerb(statement: ParsedSqlStatement): MutationVerb | null {
	const inspection = statement.inspection.trim();
	if (/^update\b/i.test(inspection)) return 'update';
	if (/^insert\s+into\b/i.test(inspection)) return 'insert';
	if (/^delete\s+from\b/i.test(inspection)) return 'delete';
	return null;
}

function collectMutationVerbs(statements: ParsedSqlStatement[]): MutationVerb[] {
	return statements.map(mutationVerb).filter((value): value is MutationVerb => value !== null);
}

function hasUnverifiableDml(statements: ParsedSqlStatement[]): boolean {
	return statements.some((statement) => {
		const code = statement.inspection;
		return /\b(?:update|insert|delete|merge)\b/i.test(code) && mutationVerb(statement) === null;
	});
}

function hasDmlInDollarBlock(statements: ParsedSqlStatement[]): boolean {
	return statements.some((statement) =>
		statement.dollarBodies.some((body) => /\b(?:update|insert|delete|merge)\b/i.test(body)),
	);
}

function checkDeclaredOperation(manifest: SqlManifest, mutations: MutationVerb[]): string[] {
	const errors: string[] = [];
	const operation = manifest.operation?.toLowerCase();
	if (operation === 'select-only' && mutations.length > 0) {
		errors.push('@operation SELECT-ONLY must not include mutating statements.');
	}
	if (
		operation &&
		operation !== 'select-only' &&
		(mutations.length === 0 || mutations.some((verb) => verb !== operation))
	) {
		errors.push(
			`@operation ${manifest.operation} must match every top-level mutation statement.`,
		);
	}
	return errors;
}

function declaredMutationTables(manifest: SqlManifest): Set<string> {
	return new Set(
		(manifest.tables ?? '')
			.split(',')
			.map((table) => table.trim().toLowerCase())
			.filter(Boolean),
	);
}

function mutationTargetTables(statements: ParsedSqlStatement[]): Set<string> {
	const mutationTables = new Set<string>();
	for (const statement of statements) {
		const match = statement.inspection.match(
			/^\s*(?:update|insert\s+into|delete\s+from)\s+(?:only\s+)?(public\.[a-z_][a-z0-9_]*)\b/i,
		);
		if (match?.[1]) mutationTables.add(match[1].toLowerCase());
	}
	return mutationTables;
}

function checkMutationTables(declaredTables: Set<string>, mutationTables: Set<string>): string[] {
	const errors: string[] = [];
	if (
		mutationTables.size > 0 &&
		([...mutationTables].some((table) => !declaredTables.has(table)) ||
			[...declaredTables].some((table) => !mutationTables.has(table)))
	) {
		errors.push('@tables must match the complete set of mutation target tables.');
	}
	return errors;
}

function checkPreviewCoversMutationTables(
	manifest: SqlManifest,
	mutationTables: Set<string>,
): string[] {
	const errors: string[] = [];
	const preview = manifest['dry-run-query']?.toLowerCase() ?? '';
	for (const table of mutationTables) {
		if (!new RegExp(`\\b${table.replace('.', '\\.')}\\b`, 'i').test(preview)) {
			errors.push(`@dry-run-query must include mutation target table ${table}.`);
		}
	}
	return errors;
}

function checkPreviewDistinctPredicate(
	manifest: SqlManifest,
	statements: ParsedSqlStatement[],
): string[] {
	const errors: string[] = [];
	const preview = manifest['dry-run-query']?.toLowerCase() ?? '';
	const mutationUsesDistinct = statements.some((statement) =>
		/\bis\s+distinct\s+from\b/i.test(statement.inspection),
	);
	if (mutationUsesDistinct && !/\bis\s+distinct\s+from\b/i.test(preview)) {
		errors.push(
			'@dry-run-query must include the mutation IS DISTINCT FROM predicate semantics.',
		);
	}
	return errors;
}

function checkPatchOperationAndTables(
	manifest: SqlManifest,
	statements: ParsedSqlStatement[],
): string[] {
	const errors: string[] = [];
	const mutations = collectMutationVerbs(statements);
	if (hasUnverifiableDml(statements) || hasDmlInDollarBlock(statements)) {
		errors.push(
			'DML must be a top-level UPDATE, INSERT, or DELETE statement that can be verified.',
		);
	}
	errors.push(...checkDeclaredOperation(manifest, mutations));
	const declaredTables = declaredMutationTables(manifest);
	const mutationTables = mutationTargetTables(statements);
	errors.push(...checkMutationTables(declaredTables, mutationTables));
	errors.push(...checkPreviewCoversMutationTables(manifest, mutationTables));
	errors.push(...checkPreviewDistinctPredicate(manifest, statements));
	return errors;
}

function checkWhereClauses(statements: ParsedSqlStatement[]): string[] {
	const errors: string[] = [];
	for (const statement of statements) {
		const verb = mutationVerb(statement);
		if (verb === 'update' && !statementHasWhere(statement.inspection)) {
			errors.push('UPDATE statements must include a WHERE clause.');
		}
		if (verb === 'delete' && !statementHasWhere(statement.inspection)) {
			errors.push('DELETE statements must include a WHERE clause.');
		}
	}
	return errors;
}

export function lintProductionPatchSql(sql: string): LintResult {
	const manifest = parseSqlManifest(sql);
	const errors = validateProductionPatchManifest(manifest);
	try {
		const statements = parseProductionPatchStatements(sql);
		const inspectedSql = statements.map((statement) => statement.inspection).join('\n');
		errors.push(...checkBlockedPatterns(inspectedSql, BLOCKED_PATTERNS));
		errors.push(...checkWhereClauses(statements));
		errors.push(...checkPatchOperationAndTables(manifest, statements));
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		errors.push(`SQL_PARSE_UNSAFE: ${detail}`);
	}

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
		throw new Error('SUPABASE_URL hostname must be a Supabase project (.supabase.co).');
	}

	return rawUrl.replace(/\/+$/, '');
}

/**
 * Validate that a value is a non-empty UUID string.
 * Returns the validated UUID on success.
 * Throws an Error with a user-facing message on validation failure.
 */
export function patchSqlRequiresOwnerUserId(sql: string): boolean {
	return /app\.owner_user_id/.test(sql);
}

export function productionPatchApplyCommand(file: string, sql: string): string {
	const owner = patchSqlRequiresOwnerUserId(sql) ? ' --owner-user-id <uuid>' : '';
	return `pnpm prod:apply -- --patch ${file}${owner} --apply`;
}

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
 *   Direct:      postgresql://user:***@db.<ref>.supabase.co:5432/postgres
 *   Direct (no prefix):
 *                postgresql://user:***@<ref>.supabase.co:5432/postgres
 *   Pooler:      postgresql://<ref>.<region>:***@<region>.pooler.supabase.com:6543/postgres
 *   Pooler (host prefix):
 *                postgresql://user:***@postgres.<ref>.pooler.supabase.com:5432/postgres
 *   Pooler (postgres user):
 *                postgresql://postgres.<ref>:***@<region>.pooler.supabase.com:5432/postgres
 *
 * The project reference is extracted from:
 *   - SUPABASE_URL: hostname (<ref>.supabase.co)
 *   - PROD_DB_URL:  hostname OR username depending on format
 */
export function assertSameSupabaseProject(supabaseUrl: string, prodDbUrl: string): void {
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
			// For pooler URLs the project reference is in the username.
			// Supported username formats:
			//   <ref>.<region>       — e.g. abcdef.us-east-1 (ref = "abcdef")
			//   postgres.<ref>       — e.g. postgres.abcdef  (ref = "abcdef")
			//   postgres.<ref>:<role> — e.g. postgres.abcdef:postgres
			const username = dbParsed.username;
			if (username) {
				const isPooler = dbParsed.hostname.toLowerCase().endsWith('.pooler.supabase.com');
				if (isPooler && username.startsWith('postgres.')) {
					// postgres.<ref> or postgres.<ref>:<role> — skip "postgres." prefix
					dbRef = username.slice('postgres.'.length).split('.')[0];
				} else {
					dbRef = username.split('.')[0];
				}
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
		if (
			error instanceof TypeError ||
			(error instanceof Error && /invalid url/i.test(error.message))
		) {
			throw new Error('PROD_DB_URL is not a valid URL. Cannot verify project consistency.', {
				cause: error,
			});
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
