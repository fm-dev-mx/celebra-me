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
