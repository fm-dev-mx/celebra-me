import { readProfileVar } from '@/lib/platform/server/env-profiles';

const ENV_NAMES = [
	'SUPABASE_URL',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
] as const;

const originalEnv: Partial<Record<(typeof ENV_NAMES)[number], string>> = {};

beforeAll(() => {
	for (const name of ENV_NAMES) originalEnv[name] = process.env[name];
});

afterAll(() => {
	for (const name of ENV_NAMES) {
		if (originalEnv[name] === undefined) delete process.env[name];
		else process.env[name] = originalEnv[name];
	}
});

beforeEach(() => {
	for (const name of ENV_NAMES) delete process.env[name];
	process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
});

describe('readProfileVar', () => {
	it('reads the plain name and reports it when absent', () => {
		expect(readProfileVar('MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN', 'account')).toEqual({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
			value: null,
			missing: {
				name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
				state: 'absent',
				scope: 'account',
			},
		});

		process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = ' shared-token ';
		expect(readProfileVar('MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN', 'preview')).toEqual({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
			value: 'shared-token',
			missing: null,
		});
	});

	it('flags invalid values without leaking them', () => {
		process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = 'not-an-account';
		const resolved = readProfileVar('MEMORIES_CLOUDFLARE_ACCOUNT_ID', 'account', (value) =>
			/^[0-9a-f]{32}$/i.test(value),
		);
		expect(resolved.value).toBeNull();
		expect(resolved.missing).toEqual({
			name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
			state: 'invalid',
			scope: 'account',
		});
	});
});
