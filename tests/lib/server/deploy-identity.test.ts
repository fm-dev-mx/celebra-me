import {
	DeployIdentityError,
	isLocalProcess,
	isProductionDeployment,
	readDeployEnvironment,
	readHostedDeployEnvironment,
	resolveDeployEnvironment,
} from '@/lib/server/deploy-identity';

const LOCAL_SUPABASE = 'http://127.0.0.1:54321';
const HOSTED_SUPABASE = 'https://iwipdvisoyerfdytuhwi.supabase.co';

describe('resolveDeployEnvironment', () => {
	it.each(['production', 'preview'] as const)(
		'answers a declared %s identity whatever the process or database',
		(deployEnv) => {
			for (const isDevServer of [true, false]) {
				for (const supabaseUrl of [LOCAL_SUPABASE, HOSTED_SUPABASE, '']) {
					expect(resolveDeployEnvironment({ deployEnv, isDevServer, supabaseUrl })).toBe(
						deployEnv,
					);
				}
			}
		},
	);

	it.each(['staging', 'development', 'Production', ' production', 'production ', 'PREVIEW'])(
		'fails closed on the invalid declared value %p',
		(deployEnv) => {
			expect(() =>
				resolveDeployEnvironment({
					deployEnv,
					isDevServer: true,
					supabaseUrl: LOCAL_SUPABASE,
				}),
			).toThrow(DeployIdentityError);
		},
	);

	it('recognizes the Astro dev server as local against any database', () => {
		expect(
			resolveDeployEnvironment({
				deployEnv: '',
				isDevServer: true,
				supabaseUrl: HOSTED_SUPABASE,
			}),
		).toBe('local');
	});

	it.each([LOCAL_SUPABASE, 'http://localhost:54321'])(
		'recognizes a built bundle on Local Supabase (%s) as local',
		(supabaseUrl) => {
			expect(
				resolveDeployEnvironment({ deployEnv: '', isDevServer: false, supabaseUrl }),
			).toBe('local');
		},
	);

	it.each([
		['a hosted project', HOSTED_SUPABASE],
		['no Supabase URL', ''],
		['https on loopback', 'https://127.0.0.1:54321'],
		['another loopback port', 'http://127.0.0.1:8080'],
		['embedded credentials', 'http://user:pass@127.0.0.1:54321'],
		['a lookalike host', 'http://127.0.0.1.evil.test:54321'],
	])('fails closed for a built bundle without identity on %s', (_label, supabaseUrl) => {
		expect(() =>
			resolveDeployEnvironment({ deployEnv: '', isDevServer: false, supabaseUrl }),
		).toThrow(/must declare CELEBRA_DEPLOY_ENV/);
	});

	it('reads CELEBRA_DEPLOY_ENV when no declaration is injected', () => {
		process.env.CELEBRA_DEPLOY_ENV = 'preview';
		expect(resolveDeployEnvironment({ isDevServer: false })).toBe('preview');
	});
});

describe('non-throwing readers', () => {
	const built = { isDevServer: false, supabaseUrl: HOSTED_SUPABASE };

	it('report hosted identities', () => {
		expect(readDeployEnvironment({ ...built, deployEnv: 'production' })).toBe('production');
		expect(readHostedDeployEnvironment({ ...built, deployEnv: 'preview' })).toBe('preview');
		expect(isProductionDeployment({ ...built, deployEnv: 'production' })).toBe(true);
		expect(isProductionDeployment({ ...built, deployEnv: 'preview' })).toBe(false);
		expect(isLocalProcess({ ...built, deployEnv: 'production' })).toBe(false);
	});

	it('treat missing and invalid identity as neither hosted nor local', () => {
		for (const deployEnv of ['', 'staging']) {
			expect(readDeployEnvironment({ ...built, deployEnv })).toBeNull();
			expect(readHostedDeployEnvironment({ ...built, deployEnv })).toBeNull();
			expect(isProductionDeployment({ ...built, deployEnv })).toBe(false);
			expect(isLocalProcess({ ...built, deployEnv })).toBe(false);
		}
	});

	it('treat a positively local process as local, not hosted', () => {
		const local = { deployEnv: '', isDevServer: true, supabaseUrl: LOCAL_SUPABASE };
		expect(readDeployEnvironment(local)).toBe('local');
		expect(readHostedDeployEnvironment(local)).toBeNull();
		expect(isLocalProcess(local)).toBe(true);
	});
});
