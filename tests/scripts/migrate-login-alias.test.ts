/** @jest-environment node */
import { spawnSync } from 'node:child_process';
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
		expect(data.calls).toHaveLength(2);
		expect(data.calls.every((call: { method: string }) => call.method === 'GET')).toBe(true);
	});
	it('requires apply and preserves protected metadata; reruns skip migrated users', () => {
		const { data } = run([legacy], true);
		expect(data.result.written).toBe(1);
		expect(data.calls[2].body).toEqual({
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
		expect(data.calls).toHaveLength(1);
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
