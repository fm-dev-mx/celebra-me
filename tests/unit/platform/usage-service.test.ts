jest.mock('@/lib/platform/server/cloudflare-usage', () => ({
	getCloudflarePlatformUsage: jest.fn(),
}));
jest.mock('@/lib/platform/server/supabase-usage', () => ({
	getSupabasePlatformUsage: jest.fn(),
}));

import { getCloudflarePlatformUsage } from '@/lib/platform/server/cloudflare-usage';
import { getSupabasePlatformUsage } from '@/lib/platform/server/supabase-usage';
import { getPlatformUsageReport } from '@/lib/platform/server/platform-usage.service';
import type { PlatformMetric } from '@/lib/platform/contract/types';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';

const NOW = new Date('2026-10-24T12:00:00.000Z');

function metric(scope: PlatformMetric['scope'], id = 'cfR2StorageBucket'): PlatformMetric {
	return {
		id,
		meter: { used: 1, limit: 10 },
		window: 'snapshot',
		scope,
		overageUsd: null,
		projection: { kind: 'unknown' },
	};
}

describe('getPlatformUsageReport', () => {
	const originalSupabaseUrl = process.env.SUPABASE_URL;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
	});

	afterAll(() => {
		if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
		else process.env.SUPABASE_URL = originalSupabaseUrl;
	});

	it('assembles one section per environment plus the shared quotas', async () => {
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			missing: [
				{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'absent', scope: 'preview' },
				{ name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID', state: 'absent', scope: 'account' },
			],
			metrics: [metric('preview'), metric('account', 'cfWorkersRequests')],
		});
		(getSupabasePlatformUsage as jest.Mock).mockRejectedValue(new Error('socket hang up'));

		const report = await getPlatformUsageReport(NOW);

		expect(report.map((section) => section.id)).toEqual(['preview', 'production', 'shared']);
		const [preview, production, shared] = report;
		expect(preview.cards.map((card) => card.provider)).toEqual(['cloudflare', 'supabase']);
		expect(production.cards.map((card) => card.provider)).toEqual(['cloudflare', 'supabase']);
		expect(shared.cards.map((card) => card.provider)).toEqual(['cloudflare']);
		// A failing provider only blanks its own card.
		expect(preview.cards[1].usage).toEqual({ kind: 'unavailable' });
		expect(preview.cards[0].usage.kind).toBe('ok');
	});

	it('splits the Cloudflare snapshot per environment and by shared scope', async () => {
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			missing: [
				{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'absent', scope: 'preview' },
				{ name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID', state: 'absent', scope: 'account' },
			],
			metrics: [
				metric('preview'),
				metric('production'),
				metric('account', 'cfWorkersRequests'),
			],
		});
		(getSupabasePlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);
		const previewCard = report[0].cards[0];
		const productionCard = report[1].cards[0];
		const sharedCard = report[2].cards[0];

		expect(previewCard.usage.kind).toBe('ok');
		if (previewCard.usage.kind !== 'ok' || productionCard.usage.kind !== 'ok') return;
		expect(previewCard.usage.metrics.map((entry) => entry.scope)).toEqual(['preview']);
		expect(previewCard.usage.missing.map((entry) => entry.name)).toEqual([
			'MEMORIES_R2_BUCKET_NAME',
		]);
		expect(productionCard.usage.metrics.map((entry) => entry.scope)).toEqual(['production']);
		expect(productionCard.usage.missing).toEqual([]);
		if (sharedCard.usage.kind !== 'ok') return;
		expect(sharedCard.usage.metrics.map((entry) => entry.id)).toEqual(['cfWorkersRequests']);
		expect(sharedCard.usage.missing.map((entry) => entry.name)).toEqual([
			'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
		]);
	});

	it('scopes a deployment panel to its own environment only', async () => {
		asHostedDeploy('production');
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'unavailable',
			fetchedAt: null,
			missing: [],
			metrics: [],
		});
		(getSupabasePlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);

		expect(report.map((section) => section.id)).toEqual(['production', 'shared']);
	});
});
