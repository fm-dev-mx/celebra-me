import {
	getPlatformUsageReport,
	type StoredSnapshot,
} from '@/lib/platform/server/platform-usage.service';
import type { PlatformSnapshotProvider } from '@/lib/platform/server/collector/types';
import type { PlatformMetric, PlatformProviderUsage } from '@/lib/platform/contract/types';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

const COLLECTED_AT = '2026-10-24T12:00:00.000Z';

type Latest = Partial<Record<PlatformSnapshotProvider, StoredSnapshot>>;

function row(
	provider: PlatformSnapshotProvider,
	payload: Record<string, unknown>,
	ok = true,
): StoredSnapshot {
	return { provider, ok, payload, collected_at: COLLECTED_AT };
}

/** One full collector run, as the Production cron stores it. */
function fullRun(): Latest {
	return {
		cloudflare_workers: row('cloudflare_workers', {
			totals: {
				today: { requests: 50, errors: 2, cpuTimeMs: 40 },
				month: { requests: 7_500_000, errors: 3, cpuTimeMs: 1_200 },
			},
		}),
		cloudflare_durable_objects: row('cloudflare_durable_objects', {
			totals: { requestsToday: 4, requestsMonth: 950_000, objects: 12, withStoredData: 3 },
		}),
		cloudflare_r2: row('cloudflare_r2', {
			buckets: [
				{
					bucketName: 'celebra-memories',
					storageBytes: 2_000_000_000,
					classA: 1,
					classB: 2,
				},
				{
					bucketName: 'celebra-memories-staging',
					storageBytes: 1_000_000,
					classA: 0,
					classB: 0,
				},
			],
			totals: { storageBytes: 2_001_000_000, classA: 1_100_000, classB: 20 },
		}),
		cloudflare_zone: row('cloudflare_zone', {
			days: [
				{ date: '2026-10-23', requests: 10, threats: 0, status403: 1, status404: 9 },
				{ date: '2026-10-24', requests: 20, threats: 1, status403: 2, status404: 30 },
			],
		}),
		supabase_disk: row('supabase_disk', { usedBytes: 333_000_000 }),
		supabase_database: row('supabase_database', { usedBytes: 69_000_000 }),
	};
}

function metrics(usage: PlatformProviderUsage): Record<string, PlatformMetric> {
	if (usage.kind !== 'ok') throw new Error(`expected ok, got ${usage.kind}`);
	return Object.fromEntries(usage.metrics.map((metric) => [metric.id, metric]));
}

describe('getPlatformUsageReport', () => {
	const originalEnv = {
		SUPABASE_URL: process.env.SUPABASE_URL,
		MEMORIES_R2_BUCKET_NAME: process.env.MEMORIES_R2_BUCKET_NAME,
	};

	beforeEach(() => {
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
		delete process.env.MEMORIES_R2_BUCKET_NAME;
	});

	afterAll(() => {
		for (const [name, value] of Object.entries(originalEnv)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	});

	it('maps every snapshot dataset onto the deployment section and the shared quotas', async () => {
		asHostedDeploy('production');
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories';

		const report = await getPlatformUsageReport(async () => fullRun());

		expect(report.map((section) => section.id)).toEqual(['production', 'shared']);
		const [production, shared] = report;
		const [cloudflare, supabase] = production.cards;
		expect(cloudflare.provider).toBe('cloudflare');
		expect(metrics(cloudflare.usage).cfR2StorageBucket).toMatchObject({
			resource: 'celebra-memories',
			meter: { used: 2_000_000_000 },
		});
		expect(cloudflare.usage).toMatchObject({ fetchedAt: COLLECTED_AT, missing: [] });

		const sb = metrics(supabase.usage);
		expect(sb.sbDatabase.meter).toEqual({ used: 69_000_000, limit: 500_000_000 });
		expect(sb.sbDisk.meter).toEqual({ used: 333_000_000, limit: null });

		const account = metrics(shared.cards[0].usage);
		expect(account.cfWorkersRequests.meter.used).toBe(7_500_000);
		expect(account.cfWorkersCpu.meter.used).toBe(1_200);
		expect(account.cfDurableObjectsRequests.meter.used).toBe(950_000);
		expect(account.cfR2StorageAccount.meter.used).toBe(2_001_000_000);
		expect(account.cfR2ClassA.overageUsd).toBe(0.45);
		expect(account.cfWorkersErrors.meter).toEqual({ used: 2, limit: null });
		expect(account.cfDurableObjectsObjects.meter.used).toBe(12);
		// Zone figures come from the collection day, not the oldest stored day.
		expect(account.cfZone404.meter.used).toBe(30);
		expect(account.cfZone403.meter.used).toBe(2);
		expect(account.cfZoneThreats.meter.used).toBe(1);
	});

	it('blanks only the meters of a failed dataset', async () => {
		asHostedDeploy('production');
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories';
		const latest = fullRun();
		latest.cloudflare_zone = row('cloudflare_zone', { failure: 'http_403' }, false);
		latest.supabase_disk = row('supabase_disk', { failure: 'timeout' }, false);

		const [production, shared] = await getPlatformUsageReport(async () => latest);

		const account = metrics(shared.cards[0].usage);
		expect(account.cfZone404.meter.used).toBeNull();
		expect(account.cfWorkersRequests.meter.used).toBe(7_500_000);
		const sb = metrics(production.cards[1].usage);
		expect(sb.sbDatabase.meter.used).toBe(69_000_000);
		expect(sb.sbDisk.meter.used).toBeNull();
	});

	it('reports collector configuration gaps as names only', async () => {
		asHostedDeploy('production');
		const unconfigured = {
			failure: 'unconfigured',
			missing: ['MEMORIES_CLOUDFLARE_ACCOUNT_ID', 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN'],
		};
		const latest: Latest = {
			cloudflare_workers: row('cloudflare_workers', unconfigured, false),
			cloudflare_durable_objects: row('cloudflare_durable_objects', unconfigured, false),
			cloudflare_r2: row('cloudflare_r2', unconfigured, false),
			cloudflare_zone: row('cloudflare_zone', unconfigured, false),
		};

		const [production, shared] = await getPlatformUsageReport(async () => latest);

		expect(shared.cards[0].usage).toEqual({
			kind: 'unconfigured',
			missing: [
				{ name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID', state: 'absent', scope: 'account' },
				{ name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN', state: 'absent', scope: 'account' },
			],
		});
		// The page's own bucket variable is still named when it is absent.
		expect(production.cards[0].usage).toEqual({
			kind: 'unconfigured',
			missing: [{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'absent', scope: 'production' }],
		});
	});

	it('marks every card unavailable when the snapshot table cannot be read', async () => {
		asHostedDeploy('preview');
		process.env.MEMORIES_R2_BUCKET_NAME = 'celebra-memories-staging';

		const report = await getPlatformUsageReport(async () => {
			throw new Error('socket hang up');
		});

		expect(report.map((section) => section.id)).toEqual(['preview', 'shared']);
		for (const section of report) {
			for (const card of section.cards) expect(card.usage).toEqual({ kind: 'unavailable' });
		}
	});
});
