/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity';

// Use Node's native ESM loader, as the existing alias audit tests do for .mjs scripts.
function run(
	users: unknown[],
	rows: unknown[],
	options: {
		cli?: boolean;
		args?: string[];
		failure?: string;
		url?: string;
	} = {},
) {
	const scriptPath = resolve(__dirname, '../../scripts/auth/check-role-app-metadata.mjs');
	const script = pathToFileURL(scriptPath).href;
	const url = options.url ?? `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
	const code = `
const users = ${JSON.stringify(users)};
const rows = ${JSON.stringify(rows)};
const calls = [];
const failure = ${JSON.stringify(options.failure)};
const fetchImpl = async (url, options) => {
 if (options.method !== 'GET' || options.body || options.redirect !== 'error') throw new Error('Unexpected mutation');
 calls.push(url);
 if (failure === 'network') throw new Error('sensitive-upstream-body');
 if (failure === 'http') return {ok: false, status: 503};
 const endpoint = new URL(url);
 const auth = endpoint.pathname === '/auth/v1/admin/users';
 const offset = auth ? Number(endpoint.searchParams.get('page')) - 1 : Number(endpoint.searchParams.get('offset'));
 // Cap both APIs at one row to prove short pages do not terminate either scan.
 let value = auth ? {users: users.slice(offset, offset + 1)} : rows.slice(offset, offset + 1);
 if (failure === 'malformed') value = null;
 if (failure === 'repeated-auth' && auth) value = {users: users.slice(0,1)};
 if (failure === 'repeated-role' && !auth) value = rows.slice(0,1);
 return {ok: true, json: async () => value};
};
${
	options.cli
		? `
globalThis.fetch = fetchImpl;
process.env.SUPABASE_URL = ${JSON.stringify(url)};
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-private-key';
process.argv = [process.execPath, ${JSON.stringify(scriptPath)}, ...${JSON.stringify(options.args ?? [])}];
await import(${JSON.stringify(script)});
`
		: `
const {auditRoles, compareRoles} = await import(${JSON.stringify(script)});
const result = await auditRoles({url: ${JSON.stringify(url)}, serviceKey: 'synthetic-private-key', fetchImpl});
console.log(JSON.stringify({result, comparison: compareRoles(users, rows), calls}));
`
}`;
	return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
}

const user = (id = 'synthetic-account', role: unknown = 'host_client') => ({
	id,
	email: 'private@example.test',
	app_metadata: { role },
});
const row = (user_id = 'synthetic-account', role: unknown = 'host_client') => ({ user_id, role });

describe('read-only role prerequisite', () => {
	it('compares both valid roles and reads all short pages from both directories', () => {
		const result = run(
			[user(), user('admin', 'super_admin')],
			[row(), row('admin', 'super_admin')],
		);
		expect(result.status).toBe(0);
		const data = JSON.parse(result.stdout);
		expect(data.comparison).toEqual({
			accounts: 2,
			matching: 2,
			differing: 0,
			orphanRoles: 0,
			ok: true,
		});
		expect(data.result).toEqual({ target: 'preview', ...data.comparison });
		expect(data.calls).toHaveLength(6);
		expect(data.calls[4]).toContain('select=user_id,role&order=user_id.asc&limit=100&offset=1');
	});

	it.each([
		['different roles', [user()], [row(undefined, 'super_admin')], 1, 0],
		['missing table row', [user()], [], 1, 0],
		['missing metadata', [{ id: 'synthetic-account' }], [row()], 1, 0],
		['both roles missing', [{ id: 'synthetic-account' }], [], 1, 0],
		['equal invalid roles', [user(undefined, 'admin')], [row(undefined, 'admin')], 1, 0],
		['non-string metadata', [user(undefined, { role: 'host_client' })], [row()], 1, 0],
		['orphan role', [user()], [row(), row('orphan')], 0, 1],
		['empty directory', [], [], 0, 0],
	])('fails closed for %s', (_, users, rows, differing, orphanRoles) => {
		const result = run(users, rows, { cli: true });
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({ differing, orphanRoles, ok: false });
		expect(result.stderr).toContain('Role prerequisite is NOT met');
	});

	it.each(['http', 'network', 'malformed', 'repeated-auth', 'repeated-role'])(
		'rejects %s without leaking upstream data or certifying partial results',
		(failure) => {
			const result = run([user()], [row()], { cli: true, failure });
			expect(result.status).toBe(1);
			expect(result.stdout).toBe('');
			expect(result.stderr).toContain('Role check failed.');
			expect(result.stderr).not.toMatch(/private|synthetic|sensitive-upstream-body/);
		},
	);

	it.each(['preview', 'production'] as const)('prints totals only for %s', (target) => {
		const result = run([user()], [row()], {
			cli: true,
			url: `https://${SUPABASE_PROJECT_REFS[target]}.supabase.co`,
		});
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			target,
			accounts: 1,
			matching: 1,
			differing: 0,
			orphanRoles: 0,
			ok: true,
		});
		expect(result.stderr).toBe('');
	});

	it('does not certify a custom endpoint as Preview or Production', () => {
		expect(
			JSON.parse(
				run([user()], [row()], { cli: true, url: 'https://unknown.supabase.co' }).stdout,
			).target,
		).toBe('unknown');
	});

	it('rejects write options and insecure endpoints', () => {
		for (const options of [{ args: ['--apply'] }, { url: 'http://external.example.test' }]) {
			const result = run([user()], [row()], { cli: true, ...options });
			expect(result.status).toBe(1);
			expect(result.stdout).toBe('');
		}
	});
});
