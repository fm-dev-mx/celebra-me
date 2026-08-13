import {
	lintProductionPatchSql,
	parseSqlManifest,
	validateProductionPatchManifest,
	argValue,
} from '../../scripts/db/sql-safety.ts';

describe('SQL production patch manifest', () => {
	it('parses required @ fields from SQL comments', () => {
		const manifest = parseSqlManifest(`
-- @script-id: 202606130001_safe_patch
-- @purpose: Repair one row
-- @env: production
-- @ticket: OPS-1
-- @tables: public.example
-- @operation: UPDATE
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.example;
-- @rollback: restore from backup
`);

		expect(manifest['script-id']).toBe('202606130001_safe_patch');
		expect(manifest.env).toBe('production');
		expect(manifest['expected-rows-max']).toBe('1');
	});

	it('requires production patch manifests to declare safety metadata', () => {
		const errors = validateProductionPatchManifest({
			'script-id': 'missing-fields',
			env: 'production',
		});

		expect(errors).toContain('Missing required manifest field: @purpose');
		expect(errors).toContain('Missing required manifest field: @expected-rows-max');
		expect(errors).toContain('Missing required manifest field: @dry-run-query');
	});

	it('rejects non-production manifests for production patch entrypoint', () => {
		const errors = validateProductionPatchManifest({
			'script-id': 'local-only',
			purpose: 'test',
			env: 'local',
			ticket: 'OPS-1',
			tables: 'public.example',
			operation: 'UPDATE',
			'expected-rows-min': '1',
			'expected-rows-max': '1',
			'requires-backup': 'true',
			'dry-run-query': 'select 1',
			rollback: 'none',
		});

		expect(errors).toContain('@env must be "production" for this entrypoint.');
	});
});

describe('SQL production patch linting', () => {
	const validPatch = `
-- @script-id: 202606130001_safe_patch
-- @purpose: Repair one row
-- @env: production
-- @ticket: OPS-1
-- @tables: public.example
-- @operation: UPDATE
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.example where id = '1';
-- @rollback: restore row snapshot

begin;
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.example where id = '1';
  if v_count <> 1 then
    raise exception 'GUARD_FAILED';
  end if;
end $$;
update public.example set name = 'safe' where id = '1';
commit;
`;

	it('accepts a manifest-bearing guarded patch', () => {
		const result = lintProductionPatchSql(validPatch);
		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('rejects UPDATE without WHERE', () => {
		const result = lintProductionPatchSql(`
-- @script-id: unsafe
-- @purpose: unsafe
-- @env: production
-- @ticket: OPS-1
-- @tables: public.example
-- @operation: UPDATE
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.example;
-- @rollback: backup
update public.example set name = 'unsafe';
`);

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('UPDATE statements must include a WHERE clause.');
	});

	it('rejects destructive statements in production patches', () => {
		const result = lintProductionPatchSql(`${validPatch}\ntruncate table public.example;`);

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('TRUNCATE is blocked for production patches.');
	});

	it('rejects representative persistent DDL while allowing TEMP tables', () => {
		const cases: Array<[string, RegExp]> = [
			['create table public.pwned (id int);', /Persistent CREATE TABLE/],
			['create index idx_pwned on public.example (id);', /CREATE INDEX belongs/],
			['create or replace function public.pwned() returns void language sql as $$ select 1 $$;', /Persistent routine creation/],
			['alter table public.example add column extra text;', /Schema-changing ALTER/],
			['drop index public.idx_example;', /Persistent DROP belongs/],
			['grant select on public.example to anon;', /GRANT\/REVOKE belongs/],
			['revoke select on public.example from anon;', /GRANT\/REVOKE belongs/],
		];
		for (const [statement, message] of cases) {
			const result = lintProductionPatchSql(`${validPatch}\n${statement}`);
			expect(result.ok).toBe(false);
			expect(result.errors.some((error) => message.test(error))).toBe(true);
		}

		const tempAllowed = lintProductionPatchSql(`${validPatch}\ncreate temp table _probe (id int) on commit drop;`);
		expect(tempAllowed.ok).toBe(true);
	});

	it('rejects DELETE without WHERE', () => {
		const result = lintProductionPatchSql(`
-- @script-id: unsafe-delete
-- @purpose: unsafe delete
-- @env: production
-- @ticket: OPS-1
-- @tables: public.example
-- @operation: DELETE
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select count(*) from public.example;
-- @rollback: backup
delete from public.example;
`);

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('DELETE statements must include a WHERE clause.');
	});
});

describe('argValue', () => {
	const originalArgv = process.argv;

	afterEach(() => {
		process.argv = originalArgv;
	});

	it('returns the value after a named flag', () => {
		process.argv = ['node', 'script.ts', '--file', 'test.sql'];
		expect(argValue('--file')).toBe('test.sql');
	});

	it('returns undefined when flag is not present', () => {
		process.argv = ['node', 'script.ts'];
		expect(argValue('--file')).toBeUndefined();
	});

	it('returns undefined when flag is last with no value', () => {
		process.argv = ['node', 'script.ts', '--file'];
		expect(argValue('--file')).toBeUndefined();
	});
});
