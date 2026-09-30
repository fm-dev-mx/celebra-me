import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	MEMORIES_GUEST_ALIAS_PATTERN,
	MEMORIES_MEDIA_STATUSES,
	MEMORIES_SHA256_HEX_PATTERN,
} from '@/lib/memories/contract/catalog';
import {
	MEMORIES_DISPLAY_NAME_MAX_LENGTH,
	MEMORIES_DISPLAY_NAME_MIN_LENGTH,
	MEMORIES_ENTITLEMENTS,
	MEMORIES_OBJECT_MAX_LIFETIME_DAYS,
	MEMORIES_OBJECT_MAX_LIFETIME_SECONDS,
	MEMORIES_SIGN_RATE_LIMIT,
} from '@/lib/memories/contract/limits';
import { MEMORIES_OBJECT_PREFIX } from '@/lib/memories/contract/object-key';
import {
	MEMORIES_PUBLIC_SLUG_MAX_LENGTH,
	MEMORIES_PUBLIC_SLUG_PATTERN,
} from '@/lib/memories/contract/private-request';
import {
	buildMemoriesR2CorsConfig,
	buildMemoriesR2LifecycleConfig,
} from '../../workers/celebra-memories-sign/r2-config';
import { parseAllowedOrigins, parseStorageTarget } from '../../workers/shared/http';
import { MEMORIES_CANONICAL_APP_ORIGIN } from '../../scripts/ops/memories-production-canary';

type RateLimitBinding = {
	name: string;
	namespace_id: string;
	simple: { limit: number; period: number };
};
type R2Binding = { binding: string; bucket_name: string };
type DurableObjectBinding = { name: string; class_name: string };
type WranglerEnvironment = {
	name?: string;
	workers_dev?: boolean;
	preview_urls?: boolean;
	routes?: unknown[];
	vars?: Record<string, string>;
	r2_buckets?: R2Binding[];
	ratelimits?: RateLimitBinding[];
	durable_objects?: { bindings: DurableObjectBinding[] };
};
type WranglerConfig = WranglerEnvironment & {
	name: string;
	main: string;
	observability?: { enabled: boolean; head_sampling_rate: number };
	migrations?: Array<{ tag: string; new_sqlite_classes?: string[] }>;
	env: Record<string, WranglerEnvironment>;
};

const WORKERS = ['celebra-memories-sign', 'celebra-memories-retrieve'] as const;
const TARGETS = ['local', 'staging', 'production'] as const;
const EXPECTED_BUCKET_SUFFIX: Record<(typeof TARGETS)[number], string> = {
	production: 'celebra-memories',
	staging: 'celebra-memories-staging',
	local: 'celebra-memories-local',
};
const PRODUCTION_ORIGIN = 'https://www.celebra-me.com';

const signWorkerDir = path.join(process.cwd(), 'workers', 'celebra-memories-sign');

function readJson<T>(...segments: string[]): T {
	return JSON.parse(readFileSync(path.join(process.cwd(), ...segments), 'utf8')) as T;
}

function readWranglerConfig(worker: (typeof WORKERS)[number]): WranglerConfig {
	return readJson<WranglerConfig>('workers', worker, 'wrangler.json');
}

function environmentFor(
	config: WranglerConfig,
	target: (typeof TARGETS)[number],
): WranglerEnvironment {
	return target === 'production' ? config : config.env[target];
}

function requireField<T>(value: T | undefined, label: string): T {
	if (value === undefined) throw new Error(`Missing ${label}`);
	return value;
}

describe('memories Workers wrangler configuration', () => {
	it.each(WORKERS)('%s projects one storage target per environment', (worker) => {
		const config = readWranglerConfig(worker);

		expect(config.name).toBe(worker);
		expect(config.main).toBe('src/index.ts');
		expect(config.vars?.MEMORIES_STORAGE_TARGET).toBe('production');
		expect(Object.keys(config.env).sort()).toEqual(['local', 'staging']);

		for (const target of TARGETS) {
			const environment = environmentFor(config, target);
			const storageTarget = requireField(
				environment.vars,
				`${worker}/${target} vars`,
			).MEMORIES_STORAGE_TARGET;
			expect(storageTarget).toBe(target);
			expect(parseStorageTarget(storageTarget)).toBe(target);
			expect(environment.routes).toEqual([]);
			expect(environment.preview_urls).toBe(false);
			expect(environment.workers_dev).toBe(target !== 'local');
			if (target !== 'production') expect(environment.name).toBe(`${worker}-${target}`);
		}
	});

	it.each(WORKERS)(
		'%s binds the private bucket, the replay guard and observability per environment',
		(worker) => {
			const config = readWranglerConfig(worker);

			expect(config.observability).toEqual({ enabled: true, head_sampling_rate: 0.05 });
			expect(config.migrations).toEqual([{ tag: 'v1', new_sqlite_classes: ['ReplayGuard'] }]);

			for (const target of TARGETS) {
				const environment = environmentFor(config, target);
				const [bucket, ...extraBuckets] = requireField(
					environment.r2_buckets,
					`${worker}/${target} r2`,
				);
				expect(extraBuckets).toEqual([]);
				expect(bucket.binding).toBe('MEMORIES_BUCKET');
				expect(bucket.bucket_name.endsWith(EXPECTED_BUCKET_SUFFIX[target])).toBe(true);
				expect(
					requireField(environment.durable_objects, `${worker}/${target} durable objects`)
						.bindings,
				).toEqual([{ name: 'NONCE_GUARD', class_name: 'ReplayGuard' }]);
			}
		},
	);

	it('points both Workers at the same bucket for each environment', () => {
		const sign = readWranglerConfig('celebra-memories-sign');
		const retrieve = readWranglerConfig('celebra-memories-retrieve');

		for (const target of TARGETS) {
			const signBucket = requireField(
				environmentFor(sign, target).r2_buckets,
				`sign/${target}`,
			)[0];
			const retrieveBucket = requireField(
				environmentFor(retrieve, target).r2_buckets,
				`retrieve/${target}`,
			)[0];
			expect(retrieveBucket.bucket_name).toBe(signBucket.bucket_name);
		}
	});

	it('binds the sign Worker rate limit from the shared contract in every environment', () => {
		const config = readWranglerConfig('celebra-memories-sign');
		const namespaceIds = new Set<string>();

		for (const target of TARGETS) {
			const [rateLimit, ...extra] = requireField(
				environmentFor(config, target).ratelimits,
				`sign/${target} ratelimits`,
			);
			expect(extra).toEqual([]);
			expect(rateLimit.name).toBe('SIGN_RATE_LIMITER');
			expect(rateLimit.simple.limit).toBe(MEMORIES_SIGN_RATE_LIMIT.limit);
			expect(rateLimit.simple.period).toBe(MEMORIES_SIGN_RATE_LIMIT.periodSeconds);
			expect(rateLimit.namespace_id).toMatch(/^\d+$/);
			namespaceIds.add(rateLimit.namespace_id);
		}
		expect(namespaceIds.size).toBe(TARGETS.length);
	});

	it('declares the browser origins allowed to PUT per environment, exactly www in production', () => {
		const config = readWranglerConfig('celebra-memories-sign');

		for (const target of TARGETS) {
			const raw = requireField(
				environmentFor(config, target).vars,
				`sign/${target} vars`,
			).MEMORIES_ALLOWED_ORIGINS;
			expect(typeof raw).toBe('string');
			const origins = parseAllowedOrigins(raw);
			expect(origins.size).toBeGreaterThan(0);
			for (const origin of origins) {
				expect(new URL(origin).origin).toBe(origin);
				expect(new URL(origin).protocol).toBe(target === 'local' ? 'http:' : 'https:');
			}
		}

		expect(config.vars?.MEMORIES_ALLOWED_ORIGINS).toBe(PRODUCTION_ORIGIN);
		expect(parseAllowedOrigins(config.vars?.MEMORIES_ALLOWED_ORIGINS)).toEqual(
			new Set([PRODUCTION_ORIGIN]),
		);
		expect(MEMORIES_CANONICAL_APP_ORIGIN).toBe(PRODUCTION_ORIGIN);
		for (const origin of parseAllowedOrigins(config.env.local.vars?.MEMORIES_ALLOWED_ORIGINS)) {
			expect(['localhost', '127.0.0.1']).toContain(new URL(origin).hostname);
		}
	});

	it('keeps the retrieve Worker server-to-server only: no browser origins', () => {
		const config = readWranglerConfig('celebra-memories-retrieve');
		for (const target of TARGETS) {
			expect(
				Object.keys(
					requireField(environmentFor(config, target).vars, `retrieve/${target} vars`),
				),
			).toEqual(['MEMORIES_STORAGE_TARGET']);
		}
	});
});

describe('memories R2 bucket configuration', () => {
	it('generates the production lifecycle rule from the contracted maximum object lifetime', () => {
		const lifecycle = readJson<ReturnType<typeof buildMemoriesR2LifecycleConfig>>(
			'workers',
			'celebra-memories-sign',
			'r2-lifecycle.production.json',
		);
		const [rule] = lifecycle.rules;

		expect(lifecycle).toEqual(buildMemoriesR2LifecycleConfig());
		expect(rule.enabled).toBe(true);
		expect(rule.conditions.prefix).toBe(MEMORIES_OBJECT_PREFIX);
		expect(rule.deleteObjectsTransition.condition).toEqual({
			maxAge: MEMORIES_OBJECT_MAX_LIFETIME_SECONDS,
			type: 'Age',
		});
		expect(MEMORIES_OBJECT_MAX_LIFETIME_SECONDS).toBe(
			MEMORIES_OBJECT_MAX_LIFETIME_DAYS * 24 * 60 * 60,
		);
	});

	it.each(['staging', 'production'] as const)(
		'closes the %s bucket to browsers through CORS',
		(target) => {
			const cors = readJson<ReturnType<typeof buildMemoriesR2CorsConfig>>(
				'workers',
				'celebra-memories-sign',
				`r2-cors.${target}.json`,
			);

			expect(cors).toEqual(buildMemoriesR2CorsConfig());
			expect(cors.rules).toHaveLength(1);
			expect(cors.rules[0].allowed).toEqual({ origins: [], methods: [], headers: [] });
		},
	);

	it('documents the local Sign Worker secrets without shipping values', () => {
		const envExample = readFileSync(path.join(signWorkerDir, '.dev.vars.example'), 'utf8');

		expect(envExample).toContain('MEMORIES_UPLOAD_CAPABILITY_SECRET=');
		expect(envExample).toContain('MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY=');
		expect(envExample).toMatch(/^MEMORIES_UPLOAD_CAPABILITY_SECRET=$/m);
		expect(envExample).toMatch(/^MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY=$/m);
		expect(envExample).not.toMatch(/R2_BUCKET=/);
		expect(envExample).not.toMatch(/^PUBLIC_/m);
		expect(envExample).not.toMatch(/MEMORIES_R2_PRESIGN/);
	});
});

describe('event memories catalog migration', () => {
	const migration = readFileSync(
		path.join(
			process.cwd(),
			'supabase',
			'migrations',
			'20260930180000_event_memories_catalog.sql',
		),
		'utf8',
	);

	it('bounds retention by the contracted maximum object lifetime', () => {
		expect(migration).toContain(`interval '${MEMORIES_OBJECT_MAX_LIFETIME_DAYS} days'`);
		expect(migration).toContain(
			`retention_ends_at <= upload_starts_at + interval '${MEMORIES_OBJECT_MAX_LIFETIME_DAYS} days'`,
		);
	});

	it('mirrors the guest session contract: display name bounds and guest alias shape', () => {
		expect(migration).toContain(
			`char_length(trim(display_name)) between ${MEMORIES_DISPLAY_NAME_MIN_LENGTH} and ${MEMORIES_DISPLAY_NAME_MAX_LENGTH}`,
		);
		expect(migration).toContain(`guest_alias ~ '${MEMORIES_GUEST_ALIAS_PATTERN.source}'`);
	});

	it('mirrors the media status list and checksum shape', () => {
		const statusList = MEMORIES_MEDIA_STATUSES.map((status) => `'${status}'`).join(', ');
		expect(migration).toContain(`status in (${statusList})`);
		expect(migration).toContain(`checksum_sha256 ~ '${MEMORIES_SHA256_HEX_PATTERN.source}'`);
	});

	it('mirrors the public slug and entitlement contracts', () => {
		const slugPattern = MEMORIES_PUBLIC_SLUG_PATTERN.source.replace('(?:', '(');
		expect(migration).toContain(`public_slug ~ '${slugPattern}'`);
		expect(migration).toContain(
			`char_length(public_slug) <= ${MEMORIES_PUBLIC_SLUG_MAX_LENGTH}`,
		);
		const entitlementList = MEMORIES_ENTITLEMENTS.map((entitlement) => `'${entitlement}'`).join(
			', ',
		);
		expect(migration).toContain(`entitlement in (${entitlementList})`);
	});

	it('keeps the catalog private to the service role', () => {
		expect(migration).toMatch(
			/revoke all on table public\.event_memory_items from public, anon, authenticated, service_role;/,
		);
		expect(migration).toMatch(/force row level security/);
		expect(migration).toMatch(/for update skip locked/i);
		expect(migration).toContain('pg_advisory_xact_lock');
		expect(migration).not.toMatch(/grant [^;]* to (anon|authenticated)\b/i);
	});
});
