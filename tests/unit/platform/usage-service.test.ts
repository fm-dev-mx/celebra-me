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

const NOW = new Date('2026-10-24T12:00:00.000Z');

describe('getPlatformUsageReport', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns one entry per provider and blanks only the failing one', async () => {
		(getCloudflarePlatformUsage as jest.Mock).mockResolvedValue({
			kind: 'ok',
			fetchedAt: NOW.toISOString(),
			metrics: [],
			spendUsd: null,
		});
		(getSupabasePlatformUsage as jest.Mock).mockRejectedValue(new Error('socket hang up'));
		(getVercelPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unconfigured' });
		(getCloudinaryPlatformUsage as jest.Mock).mockResolvedValue({ kind: 'unavailable' });

		const report = await getPlatformUsageReport(NOW);

		expect(report.cloudflare.kind).toBe('ok');
		expect(report.supabase).toEqual({ kind: 'unavailable' });
		expect(report.vercel).toEqual({ kind: 'unconfigured' });
		expect(report.cloudinary).toEqual({ kind: 'unavailable' });
	});
});
