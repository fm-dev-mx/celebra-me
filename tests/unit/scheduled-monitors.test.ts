/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	BACKUP_MAX_AGE_MS,
	CLEANUP_LOOKBACK_MS,
	CLEANUP_SLICE_MS,
	MONITOR_ENV,
	buildCleanupHeartbeatQuery,
	checkBackupFreshness,
	checkCleanupHeartbeat,
	evaluateBackupFreshness,
	planCleanupSlices,
} from '../../scripts/ops/scheduled-monitors';

const NOW = Date.parse('2026-10-19T16:40:00.000Z');
const HOUR = 60 * 60 * 1000;
const ENV = {
	[MONITOR_ENV.accountId]: '0123456789abcdef0123456789abcdef',
	[MONITOR_ENV.observabilityToken]: 'read-only-token',
	[MONITOR_ENV.r2AccessKeyId]: 'read-only-key',
	[MONITOR_ENV.r2SecretAccessKey]: 'read-only-secret',
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function listXml(objects: { key: string; size: number; at: string }[]): string {
	const contents = objects
		.map(
			({ key, size, at }) =>
				`<Contents><Key>${key}</Key><Size>${size}</Size><LastModified>${at}</LastModified></Contents>`,
		)
		.join('');
	return `<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`;
}

type HeartbeatQuery = {
	timeframe: { from: number; to: number };
	parameters: { filters: { key: string; operation: string; value: string }[] };
};

/** Structured event as Workers Logs returns it: the logged JSON lands in top-level fields. */
const COMPLETED_AT = Date.parse('2026-10-19T15:17:35.526Z');
const COMPLETED_EVENT = {
	source: { level: 'info', event: 'memories_cleanup_summary', phase: 'completed' },
	timestamp: COMPLETED_AT,
	$metadata: { service: 'celebra-me', origin: 'scheduled', trigger: '17 15 * * *' },
};

/**
 * Fake Workers Logs: matches filters against the structured fields of `events`, and answers a
 * window wider than `sampledAbove` as Workers Logs does under sampling (abr_level 10, no events).
 */
function fakeWorkersLogs(events: (typeof COMPLETED_EVENT)[], sampledAbove = Infinity) {
	return jest.fn(async (_url: string, init: RequestInit) => {
		const query = JSON.parse(init.body as string) as HeartbeatQuery;
		const { from, to } = query.timeframe;
		if (to - from > sampledAbove) {
			return jsonResponse({
				success: true,
				result: { events: { count: 0, events: [] }, statistics: { abr_level: 10 } },
			});
		}
		const field = (event: typeof COMPLETED_EVENT, key: string): unknown =>
			key.startsWith('$metadata.')
				? event.$metadata[key.slice('$metadata.'.length) as keyof typeof event.$metadata]
				: event.source[key as keyof typeof event.source];
		const matches = events.filter(
			(event) =>
				event.timestamp >= from &&
				event.timestamp <= to &&
				query.parameters.filters.every(
					(filter) => field(event, filter.key) === filter.value,
				),
		);
		return jsonResponse({
			success: true,
			result: {
				events: { count: matches.length, events: matches },
				statistics: { abr_level: 1 },
			},
		});
	});
}

describe('memories cleanup heartbeat', () => {
	it('filters on the parsed event and phase fields, not on a message string', () => {
		const query = buildCleanupHeartbeatQuery(NOW - HOUR, NOW) as unknown as HeartbeatQuery;

		expect(query.timeframe).toEqual({ from: NOW - HOUR, to: NOW });
		expect(query.parameters.filters).toEqual([
			expect.objectContaining({
				key: '$metadata.service',
				operation: 'eq',
				value: 'celebra-me',
			}),
			expect.objectContaining({
				key: 'event',
				operation: 'eq',
				value: 'memories_cleanup_summary',
			}),
			expect.objectContaining({ key: 'phase', operation: 'eq', value: 'completed' }),
		]);
		expect(JSON.stringify(query)).not.toContain('$metadata.message');
	});

	it('covers the whole lookback window with narrow slices, newest first', () => {
		const slices = planCleanupSlices(NOW);

		expect(slices[0]).toEqual([NOW - CLEANUP_SLICE_MS, NOW]);
		expect(slices.at(-1)?.[0]).toBe(NOW - CLEANUP_LOOKBACK_MS);
		for (const [index, [from, to]] of slices.entries()) {
			expect(to - from).toBeLessThanOrEqual(CLEANUP_SLICE_MS);
			if (index > 0) expect(to).toBe(slices[index - 1][0]);
		}
	});

	it('finds a structured completed summary and posts the query with the read-only token', async () => {
		const fetchImpl = fakeWorkersLogs([COMPLETED_EVENT]);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(true);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(
			'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/workers/observability/telemetry/query',
		);
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>).authorization).toBe(
			'Bearer read-only-token',
		);
	});

	it('finds the summary although Workers Logs samples any window wider than 6 hours', async () => {
		const fetchImpl = fakeWorkersLogs([COMPLETED_EVENT], 6 * HOUR);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(true);
		const windows = fetchImpl.mock.calls.map(
			([, init]) => (JSON.parse(init.body as string) as HeartbeatQuery).timeframe,
		);
		expect(windows.every(({ from, to }) => to - from <= 6 * HOUR)).toBe(true);
	});

	it('splits a sampled slice until it reads every row', async () => {
		const fetchImpl = fakeWorkersLogs([COMPLETED_EVENT], HOUR);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(true);
	});

	it('fails when the day has only a started event and no completed summary', async () => {
		const started = {
			...COMPLETED_EVENT,
			source: { ...COMPLETED_EVENT.source, phase: 'started' },
		};
		const fetchImpl = fakeWorkersLogs([started]);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(false);
		expect(result.detail).toContain('stopped after "started"');
		expect(fetchImpl).toHaveBeenCalledTimes(planCleanupSlices(NOW).length);
	});

	it('ignores a completed summary older than the lookback window', async () => {
		const old = { ...COMPLETED_EVENT, timestamp: NOW - CLEANUP_LOOKBACK_MS - HOUR };

		const result = await checkCleanupHeartbeat(
			ENV,
			NOW,
			fakeWorkersLogs([old]) as unknown as typeof fetch,
		);

		expect(result.ok).toBe(false);
	});

	it('reports an inconclusive check when even the narrowest slices are sampled', async () => {
		const fetchImpl = fakeWorkersLogs([COMPLETED_EVENT], 0);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(false);
		expect(result.detail).toContain('may have been missed');
	});

	it('fails with the API reason when the query is rejected', async () => {
		const fetchImpl = jest.fn(async () =>
			jsonResponse({ success: false, errors: [{ message: 'Authentication error' }] }, 403),
		);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result).toEqual({
			ok: false,
			detail: 'Workers Logs query failed: Authentication error.',
		});
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('refuses to run without its token', async () => {
		await expect(
			checkCleanupHeartbeat({ ...ENV, [MONITOR_ENV.observabilityToken]: '' }, NOW, jest.fn()),
		).rejects.toThrow('MONITOR_CLOUDFLARE_API_TOKEN is not set');
	});
});

describe('off-site backup freshness', () => {
	it('passes when the newest daily backup is recent and not empty', () => {
		const result = evaluateBackupFreshness(
			[
				{
					key: 'daily/2026-10-18/a.bundle.age',
					bytes: 10,
					lastModified: '2026-10-18T10:00:00Z',
				},
				{
					key: 'daily/2026-10-19/b.bundle.age',
					bytes: 10,
					lastModified: '2026-10-19T10:00:00Z',
				},
			],
			NOW,
		);

		expect(result.ok).toBe(true);
		expect(result.detail).toContain('daily/2026-10-19/b.bundle.age');
	});

	it('fails when the newest backup is older than the allowed age', () => {
		const stale = new Date(NOW - BACKUP_MAX_AGE_MS - HOUR).toISOString();
		const result = evaluateBackupFreshness(
			[{ key: 'daily/2026-10-18/a.bundle.age', bytes: 10, lastModified: stale }],
			NOW,
		);

		expect(result.ok).toBe(false);
	});

	it('fails on an empty newest backup and on an empty bucket', () => {
		expect(
			evaluateBackupFreshness(
				[
					{
						key: 'daily/2026-10-19/b.bundle.age',
						bytes: 0,
						lastModified: '2026-10-19T10:00:00Z',
					},
				],
				NOW,
			).ok,
		).toBe(false);
		expect(evaluateBackupFreshness([], NOW)).toEqual({
			ok: false,
			detail: 'The off-site bucket holds no daily backup.',
		});
	});

	it('lists only the daily prefix of the backup bucket with a GET', async () => {
		const fetchImpl = jest.fn(
			async () =>
				new Response(
					listXml([
						{
							key: 'daily/2026-10-19/b.bundle.age',
							size: 10,
							at: '2026-10-19T10:00:00Z',
						},
					]),
				),
		);

		const result = await checkBackupFreshness(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result.ok).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [request] = fetchImpl.mock.calls[0] as unknown as [Request];
		expect(request.method).toBe('GET');
		expect(request.url).toContain(
			'0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/celebra-me-prod-backups/',
		);
		expect(new URL(request.url).searchParams.get('prefix')).toBe('daily/');
	});
});

describe('scheduled monitors workflow', () => {
	const workflow = readFileSync(
		resolve('.github', 'workflows', 'scheduled-monitors.yml'),
		'utf8',
	);

	it('runs both monitors daily after the cleanup cron and the backup', () => {
		expect(workflow).toContain("- cron: '40 16 * * *'");
		expect(workflow).toContain('monitor: cleanup-heartbeat');
		expect(workflow).toContain('monitor: backup-freshness');
		expect(workflow).toContain('pnpm ops:monitor ${{ matrix.monitor }}');
		expect(workflow).toContain('gh issue create');
	});

	it('stays read-only: no write credentials, environments or apply commands', () => {
		expect(workflow).toMatch(/permissions:\s+contents: read\s+issues: write/u);
		const secrets = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(([, name]) => name);
		expect(new Set(secrets)).toEqual(
			new Set([
				'CLOUDFLARE_ACCOUNT_ID',
				'MONITOR_CLOUDFLARE_API_TOKEN',
				'MONITOR_OFFSITE_R2_ACCESS_KEY_ID',
				'MONITOR_OFFSITE_R2_SECRET_ACCESS_KEY',
			]),
		);
		expect(workflow).not.toMatch(/\bCLOUDFLARE_API_TOKEN:|environment:|--apply|wrangler/u);
	});
});
