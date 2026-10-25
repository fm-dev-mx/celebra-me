/** @jest-environment node */
import { buildMetaInsightsTable } from '@/lib/meta/insights-dashboard';
import { loadMetaInsightsTable } from '@/lib/meta/insights-dashboard.server';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

const PERIOD = { startDate: '2026-09-25', endDate: '2026-10-24' };

describe('buildMetaInsightsTable', () => {
	it('lists all 30 days newest first and keeps uncollected days as null, not zero', () => {
		const table = buildMetaInsightsTable(
			PERIOD,
			[
				{ insight_date: '2026-10-24', raw: { spend: 100.5, clicks: 10 } },
				{ insight_date: '2026-10-24', raw: { spend: 20, clicks: 2 } },
				{ insight_date: '2026-10-20', raw: { spend: 5, clicks: 1 } },
				{ insight_date: '2026-09-01', raw: { spend: 999, clicks: 999 } },
			],
			[
				{
					platform: 'facebook',
					insight_date: '2026-10-24',
					raw: { page_total_media_view_unique: 800 },
				},
				{ platform: 'instagram', insight_date: '2026-10-24', raw: { reach: 300 } },
				{ platform: 'instagram', insight_date: '2026-10-23', raw: { reach: 'bad' } },
			],
		);

		expect(table.days).toHaveLength(30);
		expect(table.days[0]).toEqual({
			date: '2026-10-24',
			spend: 120.5,
			clicks: 12,
			pageReach: 800,
			instagramReach: 300,
		});
		expect(table.days[1]).toEqual({
			date: '2026-10-23',
			spend: null,
			clicks: null,
			pageReach: null,
			instagramReach: null,
		});
		expect(table.days[29].date).toBe('2026-09-25');
		// Rows outside the window never reach the totals.
		expect(table.totals).toEqual({ spend: 125.5, clicks: 13 });
		expect(table.collectedDays).toBe(2);
	});
});

describe('loadMetaInsightsTable', () => {
	const request = jest.mocked(supabaseRestRequest);
	beforeEach(() => request.mockReset());

	it('reads the 30 completed days with the service role only', async () => {
		request.mockResolvedValue([]);
		const table = await loadMetaInsightsTable(new Date('2026-10-25T10:43:00Z'));

		expect(table.startDate).toBe('2026-09-25');
		expect(table.endDate).toBe('2026-10-24');
		const paths = request.mock.calls.map(([options]) => options.pathWithQuery);
		expect(paths[0]).toContain('meta_ads_insights_daily?select=insight_date,raw');
		expect(paths[0]).toContain('attribution_window=eq.unified');
		expect(paths[0]).toContain('insight_date=gte.2026-09-25&insight_date=lte.2026-10-24');
		expect(paths[1]).toContain('metric_period=eq.day');
		expect(request.mock.calls.every(([options]) => options.useServiceRole)).toBe(true);
	});

	it('refuses partial totals when the ads read fills a whole page', async () => {
		request
			.mockResolvedValueOnce(
				Array.from({ length: 1000 }, () => ({
					insight_date: '2026-10-24',
					raw: { spend: 1 },
				})),
			)
			.mockResolvedValueOnce([]);
		await expect(loadMetaInsightsTable(new Date('2026-10-25T10:43:00Z'))).rejects.toThrow(
			RangeError,
		);
	});
});
