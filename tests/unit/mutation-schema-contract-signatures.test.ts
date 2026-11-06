import fs from 'node:fs';
import path from 'node:path';

import { buildMutationSchemaContractQuery } from '../../scripts/db/mutation-schema-contract-query.ts';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

const TYPE_ALIASES: Record<string, string> = {
	'timestamp with time zone': 'timestamptz',
	'timestamp without time zone': 'timestamp',
	int: 'integer',
	int4: 'integer',
	int8: 'bigint',
	bool: 'boolean',
	'character varying': 'varchar',
};

const KNOWN_TYPES = new Set([
	'text',
	'uuid',
	'integer',
	'bigint',
	'boolean',
	'jsonb',
	'json',
	'timestamptz',
	'timestamp',
	'date',
	'numeric',
	'varchar',
	'smallint',
	...Object.keys(TYPE_ALIASES),
]);

function normalizeType(raw: string): string {
	const type = raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/^public\./, '');
	return TYPE_ALIASES[type] ?? type;
}

function splitTopLevel(args: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of args) {
		if (char === '(') depth += 1;
		if (char === ')') depth -= 1;
		if (char === ',' && depth === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	if (current.trim()) parts.push(current);
	return parts;
}

/** Reduces one declared argument (`p_name type default x` or a bare type) to its type. */
function argumentType(arg: string): string | null {
	let decl = arg
		.replace(/--[^\n]*/g, ' ')
		.replace(/\s+(default\b|=)[\s\S]*$/i, '')
		.trim()
		.toLowerCase();
	if (!decl) return null;
	const mode = decl.match(/^(in|out|inout|variadic)\s+/);
	if (mode?.[1] === 'out') return null;
	if (mode) decl = decl.slice(mode[0].length);
	if (KNOWN_TYPES.has(decl.replace(/\s+/g, ' '))) return normalizeType(decl);
	const tokens = decl.split(/\s+/);
	return normalizeType(tokens.length > 1 ? tokens.slice(1).join(' ') : decl);
}

function signatureOf(name: string, args: string): string {
	const types = splitTopLevel(args)
		.map(argumentType)
		.filter((type): type is string => type !== null);
	return `public.${name}(${types.join(',')})`;
}

function readBalancedArgs(sql: string, openIndex: number): string {
	let depth = 0;
	for (let i = openIndex; i < sql.length; i += 1) {
		if (sql[i] === '(') depth += 1;
		if (sql[i] === ')') {
			depth -= 1;
			if (depth === 0) return sql.slice(openIndex + 1, i);
		}
	}
	throw new Error('Unbalanced function argument list');
}

/** Replays create/drop function statements across all migrations, in filename order. */
function liveFunctionSignatures(): Set<string> {
	const live = new Set<string>();
	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith('.sql'))
		.sort();
	const statement =
		/\b(create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?)\s+"?public"?\."?([a-z0-9_]+)"?\s*\(/gi;
	for (const file of files) {
		const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
		for (const match of sql.matchAll(statement)) {
			const openIndex = (match.index ?? 0) + match[0].length - 1;
			const signature = signatureOf(match[2].toLowerCase(), readBalancedArgs(sql, openIndex));
			if (/^drop/i.test(match[1])) live.delete(signature);
			else live.add(signature);
		}
	}
	return live;
}

function contractSignatures(): string[] {
	const query = buildMutationSchemaContractQuery();
	const referenced = [
		...query.matchAll(/to_regprocedure\('([^']+)'\)/g),
		...query.matchAll(/'([^']+)'::regprocedure/g),
	].map((match) => match[1].replace(/\s+/g, ''));
	return [...new Set(referenced)];
}

// Functions the contract intentionally probes for absence (legacy objects).
const EXPECTED_ABSENT = new Set([
	'public.list_invitation_engagement_ranking(text,text)',
	'public.track_guest_invitation_view_public(text,integer)',
]);

describe('mutation schema contract function signatures', () => {
	const live = liveFunctionSignatures();
	const signatures = contractSignatures();

	it('references the function signatures it verifies', () => {
		expect(signatures.length).toBeGreaterThan(5);
	});

	it.each(signatures.filter((signature) => !EXPECTED_ABSENT.has(signature)))(
		'%s is still defined after replaying every migration',
		(signature) => {
			expect(live).toContain(signature);
		},
	);

	it('uses the 12-argument submit_guest_rsvp_public signature', () => {
		const dropped =
			'public.submit_guest_rsvp_public(text,uuid,text,text,text,integer,text,integer,text,text,text)';
		expect(live).not.toContain(dropped);
		expect(signatures).not.toContain(dropped);
		expect(signatures).toContain(
			'public.submit_guest_rsvp_public(text,uuid,text,text,text,integer,text,integer,text,text,text,integer)',
		);
	});
});
