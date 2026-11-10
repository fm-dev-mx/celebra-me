/** @jest-environment node */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity';

function run(
	users: unknown[],
	apply = false,
	failure = false,
	url = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`,
) {
	const script = pathToFileURL(resolve('scripts/auth/migrate-login-alias.mjs')).href;
	const code = `
import { migrateLoginAliases } from ${JSON.stringify(script)};
const users = ${JSON.stringify(users)};
const calls = [];
const result = await migrateLoginAliases({ url: ${JSON.stringify(url)}, serviceKey: 'synthetic', apply: ${apply}, fetchImpl: async (url, options) => {
 calls.push({url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined});
 if (${failure}) return {ok:false, status:503};
 const page = Number(new URL(url).searchParams.get('page'));
 const value = url.includes('?') ? {users: users.slice((page-1)*100,page*100)} : users.find(user => url.endsWith('/'+user.id));
 return { ok:true, json: async () => value };
}});
console.log(JSON.stringify({result,calls}));`;
	const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
		encoding: 'utf8',
	});
	return {
		status: child.status,
		error: child.stderr,
		data: child.status === 0 ? JSON.parse(child.stdout) : null,
	};
}

describe('alias migration with a simulated admin API', () => {
	const legacy = {
		id: 'u1',
		user_metadata: { login_alias: ' Alice ' },
		app_metadata: { role: 'host_client' },
	};
	it('defaults to dry-run, paginates and never writes', () => {
		const users = Array.from({ length: 101 }, (_, i) => ({
			...legacy,
			id: `u${i}`,
			user_metadata: { login_alias: `alias${i}` },
		}));
		const { status, data } = run(users);
		expect(status).toBe(0);
		expect(data.result).toMatchObject({ apply: false, planned: 101, written: 0 });
		// Two pages of accounts and the empty page that ends the listing.
		expect(data.calls).toHaveLength(3);
		expect(data.calls.every((call: { method: string }) => call.method === 'GET')).toBe(true);
	});
	it('requires apply and preserves protected metadata; reruns skip migrated users', () => {
		const { data } = run([legacy], true);
		expect(data.result.written).toBe(1);
		expect(data.calls[3].body).toEqual({
			app_metadata: { role: 'host_client', login_alias: 'alice' },
		});
		expect(
			run([{ ...legacy, app_metadata: { login_alias: 'protected' } }], true).data.result
				.written,
		).toBe(0);
	});
	it('blocks every write for duplicates, including a protected alias on another account', () => {
		const { data } = run(
			[
				legacy,
				{ id: 'u2', app_metadata: { login_alias: 'ALICE' } },
				{ id: 'u3', user_metadata: { login_alias: 'safe' } },
			],
			true,
		);
		expect(data.result.duplicates).toEqual([{ alias: 'alice', userIds: ['u1', 'u2'] }]);
		expect(data.result.written).toBe(0);
		expect(data.calls.every((call: { method: string }) => call.method === 'GET')).toBe(true);
	});
	it('fails closed on an upstream error', () => {
		expect(run([legacy], true, true).status).not.toBe(0);
	});
	it('rejects direct Production and unknown-target apply before calling the API', () => {
		for (const url of [
			`https://${SUPABASE_PROJECT_REFS.production}.supabase.co`,
			'https://unknown.supabase.co',
		]) {
			const result = run([legacy], true, false, url);
			expect(result.status).not.toBe(0);
			expect(result.error).toContain(
				'Direct Production or unknown-target apply is prohibited',
			);
		}
	});
});

/** Runs the real `--check` command against a loopback Auth admin API that serves `users`. */
async function check(users: unknown[], extraArgs: string[] = [], pageSize = 100) {
	const methods: string[] = [];
	const server = createServer((request, response) => {
		methods.push(request.method ?? '');
		const page = Number(
			new URL(request.url ?? '', 'http://localhost').searchParams.get('page'),
		);
		response.setHeader('Content-Type', 'application/json');
		response.end(
			JSON.stringify({ users: users.slice((page - 1) * pageSize, page * pageSize) }),
		);
	});
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	try {
		const child = spawn(
			process.execPath,
			[resolve('scripts/auth/migrate-login-alias.mjs'), '--check', ...extraArgs],
			{
				env: {
					...process.env,
					SUPABASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
					SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
				},
			},
		);
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		const status = await new Promise<number | null>((done) => child.on('close', done));
		return { status, stdout, stderr, methods };
	} finally {
		await new Promise((done) => server.close(done));
	}
}

describe('read-only login alias check', () => {
	const account = (index: number, placement: 'legacy' | 'protected' | 'none') => ({
		id: `account-${index}`,
		email: `person${index}@example.test`,
		user_metadata: placement === 'legacy' ? { login_alias: `Alias${index}` } : {},
		app_metadata: {
			role: 'host_client',
			...(placement === 'protected' ? { login_alias: `alias${index}` } : {}),
		},
	});
	// The directory of the 2026-11-09 incident: 28 aliases only in user_metadata.
	const beforeBackfill = Array.from({ length: 120 }, (_, index) =>
		account(index, index < 28 ? 'legacy' : index < 40 ? 'protected' : 'none'),
	);
	const afterBackfill = beforeBackfill.map((user, index) =>
		index < 28 ? account(index, 'protected') : user,
	);

	it('exits non-zero while accounts keep the alias only in user_metadata', async () => {
		const result = await check(beforeBackfill);
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toEqual({
			target: 'unknown',
			accounts: 120,
			protectedAliases: 12,
			legacyOnly: 28,
			duplicates: 0,
			ok: false,
		});
		expect(result.stderr).toContain('Login alias prerequisite is NOT met');
	});

	it('exits zero once every alias is in app_metadata', async () => {
		const result = await check(afterBackfill);
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			target: 'unknown',
			accounts: 120,
			protectedAliases: 40,
			legacyOnly: 0,
			duplicates: 0,
			ok: true,
		});
	});

	it('exits non-zero for a duplicate alias even when none is legacy-only', async () => {
		const result = await check([
			account(1, 'protected'),
			{ ...account(2, 'protected'), app_metadata: { login_alias: 'ALIAS1' } },
		]);
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			legacyOnly: 0,
			duplicates: 1,
			ok: false,
		});
	});

	it('only reads, and prints totals without any alias, email or account id', async () => {
		const result = await check(beforeBackfill);
		expect(result.methods).toEqual(['GET', 'GET', 'GET']);
		expect(`${result.stdout}${result.stderr}`).not.toMatch(/alias\d|person\d|account-\d/i);
	});

	it('does not read an empty directory as proof', async () => {
		const result = await check([]);
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({ accounts: 0, ok: false });
	});

	it('counts accounts beyond a page that the server cut short', async () => {
		const result = await check(beforeBackfill, [], 50);
		expect(JSON.parse(result.stdout)).toMatchObject({ accounts: 120, legacyOnly: 28 });
		expect(result.methods).toHaveLength(4);
	});

	it('refuses to be combined with a writing option', async () => {
		const result = await check(beforeBackfill, ['--apply']);
		expect(result.status).toBe(1);
		expect(result.methods).toEqual([]);
	});
});
