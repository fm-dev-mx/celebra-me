import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN,
	VALENTINA_MEMORIES_OBJECT_PREFIX,
	VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS,
	VALENTINA_MEMORIES_PRODUCTION_SIGN_URL,
	VALENTINA_MEMORIES_R2_BUCKET,
	VALENTINA_MEMORIES_RATE_LIMIT,
	VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT,
	VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT,
} from '@/data/valentina-memories-upload.contract';

const workerDir = path.join(process.cwd(), 'workers/celebra-memories-sign');

function readJson(relativePath: string) {
	return JSON.parse(readFileSync(path.join(workerDir, relativePath), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('celebra memories sign production config', () => {
	it('binds the Worker rate limit from the shared contract', () => {
		const wrangler = readJson('wrangler.json');
		const [rateLimit] = wrangler.ratelimits as Array<Record<string, unknown>>;
		const simple = rateLimit.simple as Record<string, number>;

		expect(wrangler.name).toBe('celebra-memories-sign');
		expect(wrangler.workers_dev).toBe(false);
		expect(wrangler.preview_urls).toBe(false);
		expect(wrangler.routes).toEqual([
			{ pattern: 'memories.celebra-me.com', custom_domain: true },
		]);
		expect(rateLimit.name).toBe(VALENTINA_MEMORIES_RATE_LIMIT.bindingName);
		expect(rateLimit.namespace_id).toBe(VALENTINA_MEMORIES_RATE_LIMIT.namespaceId);
		expect(simple.limit).toBe(VALENTINA_MEMORIES_RATE_LIMIT.limit);
		expect(simple.period).toBe(VALENTINA_MEMORIES_RATE_LIMIT.periodSeconds);
		expect([10, 60]).toContain(simple.period);
	});

	it('permits only the production browser PUT contract on the reusable bucket', () => {
		const cors = readJson('r2-cors.production.json');
		const [rule] = cors.rules as Array<{ allowed: Record<string, string[]> }>;

		expect(VALENTINA_MEMORIES_R2_BUCKET).toBe('celebra-memories');
		expect(rule.allowed.origins).toEqual([VALENTINA_MEMORIES_ALLOWED_PRODUCTION_ORIGIN]);
		expect(rule.allowed.methods).toEqual(['PUT']);
		expect(rule.allowed.headers).toEqual(['Content-Type']);
	});

	it('expires Valentina pilot objects after the contracted retention window', () => {
		const lifecycle = readJson('r2-lifecycle.production.json');
		const [rule] = lifecycle.rules as Array<{
			conditions: { prefix: string };
			deleteObjectsTransition: { condition: { maxAge: number; type: string } };
		}>;

		expect(rule.conditions.prefix).toBe(VALENTINA_MEMORIES_OBJECT_PREFIX);
		expect(rule.deleteObjectsTransition.condition.type).toBe('Age');
		expect(rule.deleteObjectsTransition.condition.maxAge).toBe(
			VALENTINA_MEMORIES_OBJECT_RETENTION_SECONDS,
		);
	});

	it('records the public sign URL without production secrets', () => {
		const owner = readFileSync(path.join(workerDir, 'OWNER.md'), 'utf8');
		const envExample = readFileSync(path.join(workerDir, '.dev.vars.example'), 'utf8');

		expect(owner).toContain(
			`${VALENTINA_MEMORIES_SIGN_URL_PUBLIC_ENV_NAME}=${VALENTINA_MEMORIES_PRODUCTION_SIGN_URL}`,
		);
		expect(owner).toContain('## Sanitized production proof table');
		expect(owner).toContain('## Rollback / disable');
		expect(owner).toContain('PENDING_OWNER');
		expect(owner).toContain(VALENTINA_MEMORIES_UPLOAD_WINDOW_STARTS_AT);
		expect(owner).toContain(VALENTINA_MEMORIES_UPLOAD_WINDOW_ENDS_AT);
		expect(owner).toMatch(/only after the window opens/);
		expect(envExample).toContain('R2_ACCOUNT_ID=');
		expect(envExample).toContain('R2_BUCKET=celebra-memories');
		expect(envExample).not.toMatch(/PUBLIC_R2_/);
		expect(envExample).not.toMatch(/^(R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)=(?!replace-)/m);
	});
});
