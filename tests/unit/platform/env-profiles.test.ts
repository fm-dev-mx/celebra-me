import {
	classifyR2BucketEnvironment,
	matchR2BucketForEnvironment,
} from '@/lib/platform/contract/environments';
import {
	isLocalPanel,
	readProfileVar,
	readSharedVar,
	resolvePanelEnvironments,
} from '@/lib/platform/server/env-profiles';

const ENV_NAMES = [
	'VERCEL_ENV',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW',
	'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
	'MEMORIES_R2_BUCKET_NAME',
	'MEMORIES_R2_BUCKET_NAME_PREVIEW',
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
});

describe('panel scoping', () => {
	it('shows both environments locally and one environment per deployment', () => {
		expect(resolvePanelEnvironments()).toEqual(['preview', 'production']);
		expect(isLocalPanel()).toBe(true);

		process.env.VERCEL_ENV = 'preview';
		expect(resolvePanelEnvironments()).toEqual(['preview']);
		expect(isLocalPanel()).toBe(false);

		process.env.VERCEL_ENV = 'production';
		expect(resolvePanelEnvironments()).toEqual(['production']);
	});
});

describe('readProfileVar', () => {
	it('prefers the Local suffixed name and falls back to the shared name', () => {
		process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN = 'shared-token';
		expect(readProfileVar('cloudflareAnalyticsToken', 'preview')).toMatchObject({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
			value: 'shared-token',
			missing: null,
		});

		process.env.MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW = 'preview-token';
		expect(readProfileVar('cloudflareAnalyticsToken', 'preview')).toMatchObject({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW',
			value: 'preview-token',
			missing: null,
		});
		expect(readProfileVar('cloudflareAnalyticsToken', 'production')).toMatchObject({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
			value: 'shared-token',
		});
	});

	it('reports the Local suffixed name when nothing is loaded for that environment', () => {
		expect(readProfileVar('cloudflareAnalyticsToken', 'production')).toEqual({
			name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
			value: null,
			missing: {
				name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
				state: 'absent',
				scope: 'production',
			},
		});
	});

	it('keeps the plain name for the R2 bucket out of Local fallbacks', () => {
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories-local';
		const local = readProfileVar('r2BucketName', 'preview', { allowPlainFallback: false });
		expect(local.value).toBeNull();
		expect(local.missing?.name).toBe('MEMORIES_R2_BUCKET_NAME_PREVIEW');

		process.env.VERCEL_ENV = 'production';
		const deployment = readProfileVar('r2BucketName', 'production', {
			allowPlainFallback: false,
		});
		expect(deployment).toMatchObject({
			name: 'MEMORIES_R2_BUCKET_NAME',
			value: 'celebra-memories-local',
		});
	});

	it('flags invalid values without leaking them', () => {
		process.env.MEMORIES_CLOUDFLARE_ACCOUNT_ID = 'not-an-account';
		const resolved = readSharedVar('MEMORIES_CLOUDFLARE_ACCOUNT_ID', 'account', (value) =>
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

describe('R2 bucket classification', () => {
	it('maps the repository bucket names to environments', () => {
		expect(classifyR2BucketEnvironment('celebra-memories')).toBe('production');
		expect(classifyR2BucketEnvironment('celebra-memories-staging')).toBe('preview');
		expect(classifyR2BucketEnvironment('celebra-memories-preview')).toBe('preview');
		expect(classifyR2BucketEnvironment('celebra-memories-local')).toBe('local');
		expect(classifyR2BucketEnvironment('celebra-memories-production')).toBe('production');
	});

	it('resolves one bucket per environment and refuses ambiguous sets', () => {
		const observed = ['celebra-memories', 'celebra-memories-staging', 'celebra-memories-local'];
		expect(matchR2BucketForEnvironment(observed, 'preview')).toBe('celebra-memories-staging');
		expect(matchR2BucketForEnvironment(observed, 'production')).toBe('celebra-memories');
		expect(matchR2BucketForEnvironment(['a-staging', 'b-preview'], 'preview')).toBeNull();
		expect(matchR2BucketForEnvironment(['celebra-memories-local'], 'production')).toBeNull();
	});
});
