import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';

interface RateLimitBinding {
	name: string;
	namespace_id: string;
	simple: { limit: number; period: number };
}

interface WorkerEnvironment {
	name: string;
	workers_dev?: boolean;
	preview_urls?: boolean;
	routes?: unknown[];
	route?: unknown;
	triggers?: { crons?: string[] };
	vars?: Record<string, string>;
	images?: { binding: string };
	ratelimits?: RateLimitBinding[];
	services?: { binding: string; service: string }[];
}

/** Drops `//` line comments outside strings; wrangler.jsonc uses no block comments. */
function stripLineComments(source: string): string {
	let output = '';
	let inString = false;
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		if (inString) {
			output += char;
			if (char === '\\') output += source[++index] ?? '';
			else if (char === '"') inString = false;
		} else if (char === '"') {
			inString = true;
			output += char;
		} else if (char === '/' && source[index + 1] === '/') {
			while (index < source.length && source[index] !== '\n') index++;
			output += '\n';
		} else {
			output += char;
		}
	}
	return output;
}

const config = JSON.parse(
	stripLineComments(readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')),
) as { env: Record<string, WorkerEnvironment> };
const preview = config.env.preview;
const production = config.env.production;

describe('wrangler.jsonc Production environment', () => {
	it('declares no traffic: no routes, no workers.dev host and no cron triggers', () => {
		expect(production.name).toBe('celebra-me');
		expect(production.routes).toBeUndefined();
		expect(production.route).toBeUndefined();
		expect(production.workers_dev).toBe(false);
		expect(production.preview_urls).toBe(true);
		expect(production.triggers).toEqual({ crons: [] });
	});

	it('identifies itself as Production on the Production Supabase project', () => {
		const supabaseUrl = `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`;
		expect(production.vars).toEqual({
			CELEBRA_DEPLOY_ENV: 'production',
			SUPABASE_URL: supabaseUrl,
			PUBLIC_SUPABASE_URL: supabaseUrl,
			BASE_URL: 'https://www.celebra-me.com',
		});
		expect(production.images).toEqual({ binding: 'IMAGES' });
	});

	it('reaches the retrieval Worker of each environment over a Service Binding', () => {
		expect(production.services).toEqual([
			{ binding: 'MEMORIES_RETRIEVE', service: 'celebra-memories-retrieve' },
		]);
		expect(preview.services).toEqual([
			{ binding: 'MEMORIES_RETRIEVE', service: 'celebra-memories-retrieve-staging' },
		]);
	});

	it('mirrors every Preview rate limit inside its own namespace range', () => {
		const shape = (bindings: RateLimitBinding[] = []) =>
			bindings.map(({ name, simple }) => ({ name, simple }));
		expect(shape(production.ratelimits)).toEqual(shape(preview.ratelimits));
		const ids = (production.ratelimits ?? []).map((binding) => Number(binding.namespace_id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toBeGreaterThanOrEqual(3001);
			expect(id).toBeLessThanOrEqual(3099);
		}
	});
});
