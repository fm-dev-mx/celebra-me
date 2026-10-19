/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	BACKUP_MAX_AGE_MS,
	CLEANUP_LOOKBACK_MS,
	MONITOR_ENV,
	buildCleanupHeartbeatQuery,
	checkBackupFreshness,
	checkCleanupHeartbeat,
	evaluateBackupFreshness,
	evaluateCleanupHeartbeat,
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

describe('memories cleanup heartbeat', () => {
	it('asks Workers Logs for completed cleanup summaries of the Production Worker', () => {
		const query = buildCleanupHeartbeatQuery(NOW) as {
			view: string;
			timeframe: { from: number; to: number };
			parameters: { filters: { key: string; operation: string; value: string }[] };
		};

		expect(query.view).toBe('events');
		expect(query.timeframe).toEqual({ from: NOW - CLEANUP_LOOKBACK_MS, to: NOW });
		expect(query.parameters.filters).toEqual([
			expect.objectContaining({ key: '$metadata.service', value: 'celebra-me' }),
			expect.objectContaining({ value: '"event":"memories_cleanup_summary"' }),
			expect.objectContaining({ value: '"phase":"completed"' }),
		]);
	});

	it('fails when the day has only a started event and no completed summary', () => {
		const result = evaluateCleanupHeartbeat({
			success: true,
			result: { events: { count: 0 } },
		});

		expect(result.ok).toBe(false);
		expect(result.detail).toContain('stopped after "started"');
	});

	it('passes with a completed summary and posts the query with the read-only token', async () => {
		const fetchImpl = jest.fn(async () =>
			jsonResponse({ success: true, result: { events: { count: 1, events: [{}] } } }),
		);

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

	it('fails with the API reason when the query is rejected', async () => {
		const fetchImpl = jest.fn(async () =>
			jsonResponse({ success: false, errors: [{ message: 'Authentication error' }] }, 403),
		);

		const result = await checkCleanupHeartbeat(ENV, NOW, fetchImpl as unknown as typeof fetch);

		expect(result).toEqual({
			ok: false,
			detail: 'Workers Logs query failed: Authentication error.',
		});
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
