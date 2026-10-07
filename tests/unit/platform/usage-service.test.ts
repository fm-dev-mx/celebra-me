jest.mock('@/lib/platform/server/cloudflare-usage', () => ({
	getCloudflarePlatformUsage: jest.fn(),
}));
jest.mock('@/lib/platform/server/supabase-usage', () => ({
	getSupabasePlatformUsage: jest.fn(),
}));
jest.mock('@/lib/platform/server/vercel-usage', () => ({
	getVercelPlatformUsage: jest.fn(),
}));
jest.mock('@/lib/platform/server/cloudinary-usage', () => ({
	getCloudinaryPlatformUsage: jest.fn(),
}));

import { getCloudflarePlatformUsage } from '@/lib/platform/server/cloudflare-usage';
import { getCloudinaryPlatformUsage } from '@/lib/platform/server/cloudinary-usage';
import { getSupabasePlatformUsage } from '@/lib/platform/server/supabase-usage';
import { getVercelPlatformUsage } from '@/lib/platform/server/vercel-usage';
import { getPlatformUsageReport } from '@/lib/platform/server/platform-usage.service';
import type { PlatformMetric } from '@/lib/platform/contract/types';

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
	const originalVercelEnv = process.env.VERCEL_ENV;

	beforeEach(() => {
		jest.clearAllMocks();
		delete process.env.VERCEL_ENV;
	});

	afterAll(() => {
		if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
		else process.env.VERCEL_ENV = originalVercelEnv;
	});

	it('assembles one section per environment plus the shared quotas', async () => {
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			missing: [
				{ name: 'MEMORIES_R2_BUCKET_NAME_PREVIEW', state: 'absent', scope: 'preview' },
				{ name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID', state: 'absent', scope: 'account' },
			],
			metrics: [metric('preview'), metric('account', 'cfWorkersRequests')],
		});
		(getSupabasePlatformUsage as jest.Mock).mockRejectedValue(new Error('socket hang up'));
		(getVercelPlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'unconfigured',
			missing: [{ name: 'VERCEL_API_TOKEN', state: 'absent', scope: 'project' }],
		});
		(getCloudinaryPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);

		expect(report.map((section) => section.id)).toEqual(['preview', 'production', 'shared']);
		const [preview, production, shared] = report;
		expect(preview.cards.map((card) => card.provider)).toEqual(['cloudflare', 'supabase']);
		expect(production.cards.map((card) => card.provider)).toEqual(['cloudflare', 'supabase']);
		expect(shared.cards.map((card) => card.provider)).toEqual([
			'cloudflare',
			'vercel',
			'cloudinary',
		]);
		// A failing provider only blanks its own card.
		expect(preview.cards[1].usage).toEqual({ kind: 'unavailable' });
		expect(shared.cards[2].usage).toEqual({ kind: 'unavailable' });
		expect(shared.cards[1].usage.kind).toBe('unconfigured');
	});

	it('splits the Cloudflare snapshot per environment and by shared scope', async () => {
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			missing: [
				{ name: 'MEMORIES_R2_BUCKET_NAME_PREVIEW', state: 'absent', scope: 'preview' },
				{ name: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID', state: 'absent', scope: 'account' },
			],
			metrics: [
				metric('preview'),
				metric('production'),
				metric('account', 'cfWorkersRequests'),
			],
		});
		(getSupabasePlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });
		(getVercelPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });
		(getCloudinaryPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);
		const previewCard = report[0].cards[0];
		const productionCard = report[1].cards[0];
		const sharedCard = report[2].cards[0];

		expect(previewCard.usage.kind).toBe('ok');
		if (previewCard.usage.kind !== 'ok' || productionCard.usage.kind !== 'ok') return;
		expect(previewCard.usage.metrics.map((entry) => entry.scope)).toEqual(['preview']);
		expect(previewCard.usage.missing.map((entry) => entry.name)).toEqual([
			'MEMORIES_R2_BUCKET_NAME_PREVIEW',
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
		process.env.VERCEL_ENV = 'production';
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'unavailable',
			fetchedAt: null,
			missing: [],
			metrics: [],
		});
		(getSupabasePlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });
		(getVercelPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });
		(getCloudinaryPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);

		expect(report.map((section) => section.id)).toEqual(['production', 'shared']);
	});
});
