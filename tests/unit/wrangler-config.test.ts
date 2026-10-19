import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import { PRODUCTION_ONLY_JOBS, SCHEDULED_JOB_CRONS } from '@/lib/server/scheduled-jobs';

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
	it('declares no traffic: no routes and no workers.dev host', () => {
		expect(production.name).toBe('celebra-me');
		expect(production.routes).toBeUndefined();
		expect(production.route).toBeUndefined();
		expect(production.workers_dev).toBe(false);
		expect(production.preview_urls).toBe(true);
	});

	it('schedules every job: the Vercel crons plus the Production-only jobs', () => {
		const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
			crons: { schedule: string }[];
		};
		const crons = production.triggers?.crons ?? [];
		const productionOnly = PRODUCTION_ONLY_JOBS.map((job) => SCHEDULED_JOB_CRONS[job]);
		expect([...crons].sort()).toEqual(Object.values(SCHEDULED_JOB_CRONS).sort());
		expect(crons.filter((cron) => !productionOnly.includes(cron)).sort()).toEqual(
			vercel.crons.map((cron) => cron.schedule).sort(),
		);
		expect(crons.filter((cron) => !productionOnly.includes(cron))).toEqual(
			preview.triggers?.crons,
		);
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

	it('reaches the private memories Workers of each environment over Service Bindings', () => {
		expect(production.services).toEqual([
			{ binding: 'MEMORIES_SIGN', service: 'celebra-memories-sign' },
			{ binding: 'MEMORIES_RETRIEVE', service: 'celebra-memories-retrieve' },
		]);
		expect(preview.services).toEqual([
			{ binding: 'MEMORIES_SIGN', service: 'celebra-memories-sign-staging' },
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

describe('wrangler.jsonc Preview environment', () => {
	it('binds every Preview cron to a scheduled job and leaves out Production-only jobs', () => {
		const crons = preview.triggers?.crons ?? [];
		const shared = (Object.keys(SCHEDULED_JOB_CRONS) as (keyof typeof SCHEDULED_JOB_CRONS)[])
			.filter((job) => !PRODUCTION_ONLY_JOBS.includes(job))
			.map((job) => SCHEDULED_JOB_CRONS[job]);
		expect(new Set(crons).size).toBe(crons.length);
		expect([...crons].sort()).toEqual(shared.sort());
	});

	it('identifies itself as Preview on the Preview Supabase project', () => {
		const supabaseUrl = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
		expect(preview.name).toBe('celebra-me-preview');
		expect(preview.vars).toEqual({
			CELEBRA_DEPLOY_ENV: 'preview',
			SUPABASE_URL: supabaseUrl,
			PUBLIC_SUPABASE_URL: supabaseUrl,
			BASE_URL: 'https://celebra-me-preview.celebra-me-com.workers.dev',
		});
		expect(preview.routes).toBeUndefined();
		expect(preview.route).toBeUndefined();
	});

	it('keeps its rate limits inside the Preview namespace range', () => {
		const ids = (preview.ratelimits ?? []).map((binding) => Number(binding.namespace_id));
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toBeGreaterThanOrEqual(2001);
			expect(id).toBeLessThanOrEqual(2099);
		}
	});
});
