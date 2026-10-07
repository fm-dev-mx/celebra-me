import { parseDiskUsedBytes } from '@/lib/platform/server/supabase-usage';
import {
	getVercelPlatformUsage,
	parseBillingChargesUsd,
	resetVercelUsageCache,
} from '@/lib/platform/server/vercel-usage';
import {
	parseCloudinaryUsage,
	readCreditsPair,
	readUsagePair,
} from '@/lib/platform/server/cloudinary-usage';

const NOW = new Date('2026-10-24T12:00:00.000Z');

describe('supabase disk parsing', () => {
	it('accepts the nested metrics envelope and flat figures alike', () => {
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: 123, fs_size_bytes: 500 } })).toBe(
			123,
		);
		expect(parseDiskUsedBytes({ fs_used_bytes: 77 })).toBe(77);
	});

	it('blanks the meter instead of guessing an unrecognized payload', () => {
		expect(parseDiskUsedBytes({})).toBeNull();
		expect(parseDiskUsedBytes(null)).toBeNull();
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: 'huge' } })).toBeNull();
		expect(parseDiskUsedBytes({ metrics: { fs_used_bytes: -5 } })).toBeNull();
	});
});

describe('vercel billing parsing', () => {
	it('sums FOCUS rows and rounds to cents', () => {
		const payload = [
			'{"BilledCost":"0.00","ServiceCategory":"Compute"}',
			'{"BilledCost":"1.235","ServiceCategory":"Storage"}',
			'',
		].join('\n');
		expect(parseBillingChargesUsd(payload)).toBe(1.24);
	});

	it('returns null for empty or unrecognized payloads instead of reporting $0', () => {
		expect(parseBillingChargesUsd('')).toBeNull();
		expect(parseBillingChargesUsd('{"note":"nothing billable"}')).toBeNull();
		expect(parseBillingChargesUsd('not json')).toBeNull();
	});

	it('returns unavailable when the billing endpoint fails with an HTTP error', async () => {
		const originalToken = process.env.VERCEL_API_TOKEN;
		process.env.VERCEL_API_TOKEN = 'test-token';
		resetVercelUsageCache();
		try {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: false,
				status: 500,
			} as unknown as Response);
			const usage = await getVercelPlatformUsage(NOW, mockFetch as unknown as typeof fetch);
			expect(usage).toEqual({ kind: 'unavailable' });
		} finally {
			resetVercelUsageCache();
			if (originalToken === undefined) {
				delete process.env.VERCEL_API_TOKEN;
			} else {
				process.env.VERCEL_API_TOKEN = originalToken;
			}
		}
	});
});

describe('cloudinary usage parsing', () => {
	it('reads nested usage pairs and flat numbers with their limits', () => {
		expect(readUsagePair({ storage: { usage: 10, limit: 25 } }, 'storage')).toEqual({
			used: 10,
			limit: 25,
		});
		expect(readUsagePair({ requests: 5_000 }, 'requests')).toEqual({
			used: 5_000,
			limit: null,
		});
		expect(readCreditsPair({ used_credits: 3, credits: 25 })).toEqual({ used: 3, limit: 25 });
		expect(readCreditsPair({ credits: { usage: 3, limit: 25 } })).toEqual({
			used: 3,
			limit: 25,
		});
	});

	it('builds account-scoped metrics and blanks everything it cannot read', () => {
		const usage = parseCloudinaryUsage(
			{
				used_credits: 3,
				credits: 25,
				storage: { usage: 40, limit: 25 },
				bandwidth: 100,
				requests: 9,
				resources: 12,
			},
			NOW,
		);
		expect(usage.kind).toBe('ok');
		if (usage.kind !== 'ok') return;
		expect(usage.spendUsd).toBeNull();
		const credits = usage.metrics.find((metric) => metric.id === 'clCredits');
		expect(credits?.meter).toEqual({ used: 3, limit: 25 });
		expect(credits?.window).toBe('creditCycle');
		const storage = usage.metrics.find((metric) => metric.id === 'clStorage');
		expect(storage?.meter).toEqual({ used: 40, limit: 25 });
		expect(storage?.scope).toBe('account');
		expect(parseCloudinaryUsage({}, NOW)).toEqual({ kind: 'unavailable' });
		expect(parseCloudinaryUsage('nope', NOW)).toEqual({ kind: 'unavailable' });
	});
});
