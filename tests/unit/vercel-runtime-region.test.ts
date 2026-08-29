import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface VercelFunctionConfig {
	regions?: unknown;
	functionFailoverRegions?: unknown;
}

interface VercelConfig {
	regions?: unknown;
	functionFailoverRegions?: unknown;
	functions?: Record<string, VercelFunctionConfig>;
}

function readVercelConfig(): VercelConfig {
	return JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as VercelConfig;
}

describe('Vercel deployment region configuration', () => {
	it('configures sfo1 as the single primary function region', () => {
		const config = readVercelConfig();

		expect(config.regions).toEqual(['sfo1']);
		for (const functionConfig of Object.values(config.functions ?? {})) {
			expect(functionConfig.regions ?? ['sfo1']).toEqual(['sfo1']);
		}
	});

	it('does not configure function failover in vercel.json', () => {
		const config = readVercelConfig();

		expect(config.functionFailoverRegions).toBeUndefined();
		for (const functionConfig of Object.values(config.functions ?? {})) {
			expect(functionConfig.functionFailoverRegions).toBeUndefined();
		}
	});
});
