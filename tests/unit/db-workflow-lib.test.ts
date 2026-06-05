import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	REFRESH_PARITY_TABLES,
	createProdBackup,
	ensureTablesExist,
	getMissingTables,
	sqlLiteral,
	transformDumpForStaging,
	validateRefreshParity,
} from '../../scripts/db/db-workflow-lib.ts';

jest.mock('node:child_process', () => ({
	spawnSync: jest.fn(() => ({ status: 0, stdout: '', stderr: '', error: undefined })),
}));

jest.mock('node:fs', () => {
	const actual = jest.requireActual('node:fs');
	return {
		...actual,
		mkdirSync: jest.fn(),
	};
});

const { spawnSync } = jest.requireMock('node:child_process') as {
	spawnSync: jest.Mock;
};

describe('sqlLiteral', () => {
	it('wraps a plain string in single quotes', () => {
		expect(sqlLiteral('hello')).toBe("'hello'");
	});

	it('returns empty quoted string for empty input', () => {
		expect(sqlLiteral('')).toBe("''");
	});

	it('escapes embedded single quotes by doubling them', () => {
		expect(sqlLiteral("it's")).toBe("'it''s'");
		expect(sqlLiteral("a''b")).toBe("'a''''b'");
	});

	it('preserves newlines inside the literal', () => {
		expect(sqlLiteral('line1\nline2')).toBe("'line1\nline2'");
	});

	it('preserves unicode characters', () => {
		expect(sqlLiteral('celebra-me \u00f1')).toBe("'celebra-me \u00f1'");
		expect(sqlLiteral('\u{1F600}')).toBe("'\u{1F600}'");
	});

	it('preserves backslashes', () => {
		expect(sqlLiteral('path\\to\\file')).toBe("'path\\to\\file'");
	});

	it('handles multiple special characters together', () => {
		expect(sqlLiteral("O'Brien\n\u00e9\\x")).toBe("'O''Brien\n\u00e9\\x'");
	});
});

describe('createProdBackup', () => {
	const fakeUrl = 'postgresql://user:pass@db.example.supabase.co:5432/postgres';

	beforeEach(() => {
		spawnSync.mockClear();
	});

	it('passes --data-only and --use-copy for data backup (schemaOnly=false)', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', false);
		expect(spawnSync).toHaveBeenCalledTimes(1);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--data-only');
		expect(args).toContain('--use-copy');
		expect(args).not.toContain('--schema-only');
	});

	it('passes --schema-only for schema backup (schemaOnly=true)', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', true);
		expect(spawnSync).toHaveBeenCalledTimes(1);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema-only');
		expect(args).not.toContain('--data-only');
		expect(args).not.toContain('--use-copy');
	});

	it('includes --schema public and -f output in both modes', () => {
		createProdBackup(fakeUrl, '/tmp/data.sql', false);
		let args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema');
		expect(args).toContain('public');
		expect(args).toContain('-f');
		expect(args).toContain('/tmp/data.sql');

		spawnSync.mockClear();
		createProdBackup(fakeUrl, '/tmp/schema.sql', true);
		args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--schema');
		expect(args).toContain('public');
		expect(args).toContain('-f');
		expect(args).toContain('/tmp/schema.sql');
	});

	it('passes the db-url via --db-url arg', () => {
		createProdBackup(fakeUrl, '/tmp/dump.sql', false);
		const args = spawnSync.mock.calls[0][1] as string[];
		expect(args).toContain('--db-url');
		expect(args).toContain(fakeUrl);
	});
});

describe('refresh-copy.sql placeholder guard', () => {
	it('contains only the known placeholders __STAGING_SCHEMA__ and __STORAGE_BUCKET_SIZE_LIMIT__', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const template = readFileSync(sqlPath, 'utf8');
		const placeholders = template.match(/__[A-Z_]+__/g) ?? [];
		const known = new Set(['__STAGING_SCHEMA__', '__STORAGE_BUCKET_SIZE_LIMIT__']);
		const unknown = placeholders.filter((p) => !known.has(p));
		expect(unknown).toEqual([]);
	});

	it('has all known placeholders fully replaced after loadCopySql logic', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const template = readFileSync(sqlPath, 'utf8');
		const replaced = template
			.replaceAll('__STAGING_SCHEMA__', 'refresh_staging')
			.replaceAll('__STORAGE_BUCKET_SIZE_LIMIT__', '10485760');
		const remaining = replaced.match(/__[A-Z_]+__/g);
		expect(remaining).toBeNull();
	});

	it('copy-loop uses explicit ordered table list joined with pg_tables for intersection guard', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const template = readFileSync(sqlPath, 'utf8');

		// The copy loop must join an explicit copy_order with pg_tables
		// to intersect with the staging schema and follow FK-safe order.
		expect(template).toMatch(/from copy_order o\s+inner join pg_tables p/);
		expect(template).toMatch(/inner join pg_tables s\s+on s\.tablename\s*=\s*o\.tablename/);
		expect(template).toMatch(/s\.schemaname\s*=\s*'__STAGING_SCHEMA__'/);
	});

	function parseCopyOrder(sqlContent: string): string[] {
		const tables: { pos: number; name: string }[] = [];
		const regex = /\((\d+),\s*'([^']+)'\)/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(sqlContent)) !== null) {
			tables.push({ pos: parseInt(m[1], 10), name: m[2] });
		}
		return tables.sort((a, b) => a.pos - b.pos).map((t) => t.name);
	}

	it('copies events before event_claim_codes (FK-safe order)', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const order = parseCopyOrder(readFileSync(sqlPath, 'utf8'));
		const eventsIdx = order.indexOf('events');
		const claimCodesIdx = order.indexOf('event_claim_codes');
		expect(eventsIdx).toBeGreaterThanOrEqual(0);
		expect(claimCodesIdx).toBeGreaterThan(eventsIdx);
	});

	it('copies intake_requests before intake_submissions (FK-safe order)', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const order = parseCopyOrder(readFileSync(sqlPath, 'utf8'));
		const requestsIdx = order.indexOf('intake_requests');
		const submissionsIdx = order.indexOf('intake_submissions');
		expect(requestsIdx).toBeGreaterThanOrEqual(0);
		expect(submissionsIdx).toBeGreaterThan(requestsIdx);
	});

	it('copies invitations before events (FK-safe order)', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const order = parseCopyOrder(readFileSync(sqlPath, 'utf8'));
		const invitationsIdx = order.indexOf('invitations');
		const eventsIdx = order.indexOf('events');
		expect(invitationsIdx).toBeGreaterThanOrEqual(0);
		expect(eventsIdx).toBeGreaterThan(invitationsIdx);
	});

	it('includes all known public tables in the copy order', () => {
		const sqlPath = resolve(process.cwd(), 'scripts', 'db', 'sql', 'refresh-copy.sql');
		const order = parseCopyOrder(readFileSync(sqlPath, 'utf8'));
		const expected = [
			'app_user_roles',
			'audit_logs',
			'event_claim_codes',
			'event_memberships',
			'events',
			'guest_invitation_audit',
			'guest_invitations',
			'host_profiles',
			'intake_requests',
			'intake_submissions',
			'invitation_assets',
			'invitation_content_drafts',
			'invitations',
			'published_invitation_content',
			'rsvp_audit_log',
			'rsvp_channel_log',
			'rsvp_records',
		];
		for (const table of expected) {
			expect(order).toContain(table);
		}
	});
});

describe('transformDumpForStaging', () => {
	const TARGET = 'refresh_staging';

	it('transforms unquoted public. references to target schema', () => {
		const input = `COPY public.invitations (id, name) FROM stdin;
1	"test"
\\.`;
		const output = transformDumpForStaging(input, TARGET);
		expect(output).toContain('COPY refresh_staging.invitations (id, name) FROM stdin;');
	});

	it('transforms quoted "public"." references to target schema', () => {
		const input = `COPY "public"."invitations" ("id", "name") FROM stdin;
1	"test"
\\.`;
		const output = transformDumpForStaging(input, TARGET);
		expect(output).toContain('COPY "refresh_staging"."invitations" ("id", "name") FROM stdin;');
	});

	it('does not mutate COPY payload data while inside a COPY block', () => {
		const input = [
			'COPY "public"."invitations" ("id", "content") FROM stdin;',
			'1	{"text":"See public.events and \\"public\\".\\"invitations\\""}',
			'\\.',
			'',
		].join('\n');

		const output = transformDumpForStaging(input, TARGET);

		expect(output).toContain('COPY "refresh_staging"."invitations"');
		expect(output).toContain('See public.events and \\"public\\".\\"invitations\\"');
		expect(output).not.toContain('See refresh_staging.events');
	});

	it('transforms SET search_path with quoted public', () => {
		const input = 'SET search_path = "public",\nCOPY "public"."t" ("c") FROM stdin;\n1\n\\.';
		const output = transformDumpForStaging(input, TARGET);
		expect(output).toContain('SET search_path = refresh_staging,');
	});

	it('transforms SET search_path with unquoted public', () => {
		const input = 'SET search_path = public,\nCOPY "public"."t" ("c") FROM stdin;\n1\n\\.';
		const output = transformDumpForStaging(input, TARGET);
		expect(output).toContain('SET search_path = refresh_staging,');
	});

	it('handles multiple COPY blocks, only transforming header lines', () => {
		const input = [
			'COPY "public"."events" ("id") FROM stdin;',
			'1',
			'\\.',
			'COPY "public"."invitations" ("id") FROM stdin;',
			'10',
			'\\.',
		].join('\n');
		const output = transformDumpForStaging(input, TARGET);
		expect(output).toContain('COPY "refresh_staging"."events"');
		expect(output).toContain('COPY "refresh_staging"."invitations"');
		const lines = output.split('\n');
		expect(lines[1]).toBe('1');
		expect(lines[2]).toBe('\\.');
		expect(lines[4]).toBe('10');
		expect(lines[5]).toBe('\\.');
	});

	it('passes through empty input', () => {
		expect(transformDumpForStaging('', TARGET)).toBe('');
	});

	it('passes through input with no public references', () => {
		const input = 'SET statement_timeout = 0;\nRESET ALL;\n';
		expect(transformDumpForStaging(input, TARGET)).toBe(input);
	});
});

describe('validateRefreshParity', () => {
	it('returns ok when all counts match', () => {
		const result = validateRefreshParity({
			sourceCounts: { invitations: 13, events: 5 },
			targetCounts: { invitations: 13, events: 5 },
		});
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it('fails when production has rows but local is zero', () => {
		const result = validateRefreshParity({
			sourceCounts: { invitations: 13 },
			targetCounts: { invitations: 0 },
		});
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toMatchObject({
			table: 'invitations',
			sourceCount: 13,
			targetCount: 0,
			reason: 'count_mismatch',
		});
	});

	it('fails on count mismatch by default', () => {
		const result = validateRefreshParity({
			sourceCounts: { invitations: 13 },
			targetCounts: { invitations: 10 },
		});
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toMatchObject({
			table: 'invitations',
			sourceCount: 13,
			targetCount: 10,
			reason: 'count_mismatch',
		});
	});

	it('allows count mismatch when maxDelta is Infinity', () => {
		const result = validateRefreshParity({
			sourceCounts: { audit_logs: 5 },
			targetCounts: { audit_logs: 50 },
			maxDeltas: { audit_logs: Infinity },
		});
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it('passes when both source and target are zero', () => {
		const result = validateRefreshParity({
			sourceCounts: { empty_table: 0 },
			targetCounts: { empty_table: 0 },
		});
		expect(result.ok).toBe(true);
	});

	it('reports multiple failures', () => {
		const result = validateRefreshParity({
			sourceCounts: { a: 5, b: 3, c: 0 },
			targetCounts: { a: 0, b: 1, c: 0 },
		});
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(2);
	});

	describe('maxDeltas', () => {
		it('passes when target has exactly one more row than source (delta=1 allowed)', () => {
			const result = validateRefreshParity({
				sourceCounts: { app_user_roles: 6 },
				targetCounts: { app_user_roles: 7 },
				maxDeltas: { app_user_roles: 1 },
			});
			expect(result.ok).toBe(true);
			expect(result.failures).toEqual([]);
		});

		it('passes when target has the same count as source (delta=0, within maxDelta=1)', () => {
			const result = validateRefreshParity({
				sourceCounts: { app_user_roles: 6 },
				targetCounts: { app_user_roles: 6 },
				maxDeltas: { app_user_roles: 1 },
			});
			expect(result.ok).toBe(true);
			expect(result.failures).toEqual([]);
		});

		it('fails when target has two more rows than source (delta=2 exceeds maxDelta=1)', () => {
			const result = validateRefreshParity({
				sourceCounts: { app_user_roles: 6 },
				targetCounts: { app_user_roles: 8 },
				maxDeltas: { app_user_roles: 1 },
			});
			expect(result.ok).toBe(false);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]).toMatchObject({
				table: 'app_user_roles',
				reason: 'count_mismatch',
			});
		});

		it('fails when target has fewer rows than source (negative delta never allowed)', () => {
			const result = validateRefreshParity({
				sourceCounts: { app_user_roles: 6 },
				targetCounts: { app_user_roles: 5 },
				maxDeltas: { app_user_roles: 1 },
			});
			expect(result.ok).toBe(false);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]).toMatchObject({
				table: 'app_user_roles',
				sourceCount: 6,
				targetCount: 5,
				reason: 'count_mismatch',
			});
		});

		it('does not affect strict tables without a maxDelta entry', () => {
			const result = validateRefreshParity({
				sourceCounts: { events: 5, app_user_roles: 6 },
				targetCounts: { events: 6, app_user_roles: 7 },
				maxDeltas: { app_user_roles: 1 },
			});
			// app_user_roles: 7-6=1, within maxDelta=1 → pass
			// events: 6-5=1, no maxDelta → fail strict
			expect(result.ok).toBe(false);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]).toMatchObject({
				table: 'events',
				reason: 'count_mismatch',
			});
		});
	});
});

describe('REFRESH_PARITY_TABLES', () => {
	it('does not include invitation_assets (not yet present in production)', () => {
		expect(REFRESH_PARITY_TABLES).not.toContain('invitation_assets');
	});

	it('includes all tables that exist in both production and local', () => {
		expect(REFRESH_PARITY_TABLES).toContain('invitations');
		expect(REFRESH_PARITY_TABLES).toContain('events');
		expect(REFRESH_PARITY_TABLES).toContain('published_invitation_content');
		expect(REFRESH_PARITY_TABLES).toContain('guest_invitations');
		expect(REFRESH_PARITY_TABLES).toContain('invitation_content_drafts');
		expect(REFRESH_PARITY_TABLES).toContain('intake_requests');
		expect(REFRESH_PARITY_TABLES).toContain('intake_submissions');
		expect(REFRESH_PARITY_TABLES).toContain('app_user_roles');
		expect(REFRESH_PARITY_TABLES).toContain('event_memberships');
		expect(REFRESH_PARITY_TABLES).toContain('event_claim_codes');
	});
});

describe('getMissingTables', () => {
	it('returns empty array when all expected tables exist', () => {
		expect(getMissingTables(['invitations', 'events'], ['invitations', 'events'])).toEqual([]);
	});

	it('returns missing table when one is absent', () => {
		expect(getMissingTables(['invitations', 'events'], ['invitations'])).toEqual(['events']);
	});

	it('returns all expected when existing list is empty', () => {
		expect(getMissingTables(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
	});

	it('returns empty when both lists are empty', () => {
		expect(getMissingTables([], [])).toEqual([]);
	});

	it('returns empty when expected is empty regardless of existing', () => {
		expect(getMissingTables([], ['a', 'b'])).toEqual([]);
	});

	it('does not change the original arrays', () => {
		const expected = ['a', 'b'];
		const existing = ['a'];
		const result = getMissingTables(expected, existing);
		expect(result).toEqual(['b']);
		expect(expected).toEqual(['a', 'b']);
		expect(existing).toEqual(['a']);
	});
});

describe('ensureTablesExist', () => {
	beforeEach(() => {
		spawnSync.mockClear();
	});

	it('passes when all tables exist in the target schema', () => {
		spawnSync.mockReturnValue({
			status: 0,
			stdout: 'invitations\nevents\npublished_invitation_content\nguest_invitations\ninvitation_content_drafts\nintake_requests\nintake_submissions\napp_user_roles\nevent_memberships\nevent_claim_codes\n',
			stderr: '',
			error: undefined,
		});

		expect(() =>
			ensureTablesExist(
				[...REFRESH_PARITY_TABLES],
				'public',
				'postgresql://localhost/postgres',
			),
		).not.toThrow();
	});

	it('fails when a table is missing', () => {
		spawnSync.mockReturnValue({
			status: 0,
			stdout: 'invitations\nevents\n',
			stderr: '',
			error: undefined,
		});

		expect(() =>
			ensureTablesExist(
				['invitations', 'events', 'missing_table'],
				'public',
				'postgresql://localhost/postgres',
				'test-target',
			),
		).toThrow('missing_table');
	});

	it('includes the schema and label in the error message', () => {
		spawnSync.mockReturnValue({
			status: 0,
			stdout: '',
			stderr: '',
			error: undefined,
		});

		expect(() =>
			ensureTablesExist(
				['table_a', 'table_b'],
				'public',
				'postgresql://localhost/postgres',
				'test-target',
			),
		).toThrow(/Refresh parity table.*not found.*"public".*test-target/);
	});

	it('lists all missing tables in the error', () => {
		spawnSync.mockReturnValue({
			status: 0,
			stdout: '',
			stderr: '',
			error: undefined,
		});

		expect(() =>
			ensureTablesExist(
				['table_a', 'table_b'],
				'public',
				'postgresql://localhost/postgres',
				'test-target',
			),
		).toThrow(/table_a[\s\S]*table_b/);
	});
});
