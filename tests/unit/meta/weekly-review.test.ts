/** @jest-environment node */
import {
	normalizeMetaQuality,
	metaReviewWeek,
	metaWeeklyReviewSchema,
	metaReviewNeedsAttention,
} from '@/lib/meta/weekly-review';
import { loadMetaWeeklyReview, runMetaWeeklyReview } from '@/lib/meta/weekly-review.server';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { readDeployEnvironment } from '@/lib/server/deploy-identity';
import { getEnv } from '@/lib/server/env';
import { loadMetaInsightsTable } from '@/lib/meta/insights-dashboard.server';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));
jest.mock('@/lib/server/env', () => ({ getEnv: jest.fn() }));
jest.mock('@/lib/server/deploy-identity', () => ({ readDeployEnvironment: jest.fn() }));
jest.mock('@/lib/meta/insights-dashboard.server', () => ({ loadMetaInsightsTable: jest.fn() }));
jest.mock('@/lib/tracking/commercial-dashboard.server', () => ({
	loadCommercialDashboardData: jest.fn(async () => ({
		totals: { leads: 2 },
		sales: { orders: 1 },
		conversionStatusCounts: { pending: 1, failed: 0, ambiguous: 0 },
		recentLeads: [{ email: 'private@example.test' }],
	})),
}));
jest.mock('@/lib/tracking/commercial-dashboard', () => ({
	buildCommercialDashboardViewModel: jest.fn(() => ({ health: { capi: { status: 'correct' } } })),
}));

const now = new Date('2026-10-26T12:00:00Z');
const token = 'synthetic-weekly-token';
const quality = {
	web: [
		{
			event_name: 'Contact',
			event_match_quality: { composite_score: 7 },
			event_coverage: { percentage: 80 },
			dedupe_key_feedback: [
				{
					dedupe_key: 'event_id',
					browser_events_with_dedupe_key: { percentage: 99 },
					server_events_with_dedupe_key: { percentage: 100 },
					overall_browser_coverage_from_dedupe_key: { percentage: 80 },
				},
			],
		},
	],
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('weekly Meta review', () => {
	let stored: unknown;
	let fetchMock: jest.MockedFunction<typeof fetch>;
	beforeEach(() => {
		jest.clearAllMocks();
		stored = null;
		jest.mocked(readDeployEnvironment).mockReturnValue('production');
		jest.mocked(getEnv).mockImplementation(
			(name) =>
				({
					META_DATASET_QUALITY_ACCESS_TOKEN: token,
					META_WEEKLY_REVIEW_WEBHOOK_URL: 'https://notify.example.test/hook',
				})[name] ?? '',
		);
		jest.mocked(loadMetaInsightsTable).mockResolvedValue({
			startDate: '2026-09-26',
			endDate: '2026-10-25',
			days: Array.from({ length: 7 }, (_, index) => ({
				date: `2026-10-${19 + index}`,
				spend: 1,
				clicks: 2,
				pageReach: 3,
				instagramReach: 4,
			})),
			totals: { spend: 7, clicks: 14 },
			collectedDays: 7,
		});
		jest.mocked(supabaseRestRequest).mockImplementation(async (request) => {
			if (request.method === 'POST') {
				const rows = request.body as { raw: unknown }[];
				stored = JSON.parse(JSON.stringify(rows[0].raw));
				return undefined as never;
			}
			return (stored ? [{ raw: stored }] : []) as never;
		});
		fetchMock = jest
			.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
			.mockImplementation(async (url) =>
				String(url).includes('graph.facebook.com') ? json(quality) : json({}),
			);
		jest.spyOn(console, 'info').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([
		['2026-10-25', '2026-10-19', '2026-10-25'],
		['2026-10-26', '2026-10-19', '2026-10-25'],
		['2027-01-01', '2026-12-21', '2026-12-27'],
	])('resolves a completed calendar week from %s', (day, startDate, endDate) => {
		expect(metaReviewWeek(day)).toEqual({ startDate, endDate });
	});
	it('keeps missing, malformed and out-of-range quality unknown; retains real zero', () => {
		expect(
			normalizeMetaQuality([
				{
					event_name: 'Lead',
					event_match_quality: { composite_score: 0 },
					event_coverage: { percentage: 101 },
				},
			])[0],
		).toEqual({
			event: 'Lead',
			emq: 0,
			coverage: null,
			browserKeys: null,
			serverKeys: null,
			dedupCoverage: null,
		});
		expect(() => normalizeMetaQuality([{ event_name: '<script>' }])).toThrow();
	});
	it.each(['preview', 'local', null] as const)('does no work in %s', async (identity) => {
		jest.mocked(readDeployEnvironment).mockReturnValue(identity);
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('skipped');
		expect(supabaseRestRequest).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('persists aggregate-only report before notice, keeps credentials out of URL and storage', async () => {
		await expect(runMetaWeeklyReview({ now, fetchImpl: fetchMock })).resolves.toBe('completed');
		const report = metaWeeklyReviewSchema.parse(stored);
		expect(report).toMatchObject({
			startDate: '2026-10-19',
			endDate: '2026-10-25',
			notice: 'sent',
			insights: { adsDays: 7, spend: 7, clicks: 14 },
			quality: [{ event: 'Contact', emq: 7, dedupCoverage: 80 }],
		});
		expect(JSON.stringify(stored)).not.toMatch(
			/private@example|synthetic-weekly-token|notify.example/,
		);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain('/v26.0/dataset_quality?dataset_id=1348260657445453');
		expect(String(url)).not.toContain(token);
		expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` });
		expect(fetchMock.mock.calls[1][1]).toMatchObject({
			redirect: 'manual',
			headers: { 'Idempotency-Key': 'meta-weekly-review:1348260657445453:2026-10-25' },
		});
		expect(await loadMetaWeeklyReview()).toEqual(report);
	});
	it('does not repeat a delivered week but creates the next one', async () => {
		await runMetaWeeklyReview({ now, fetchImpl: fetchMock });
		fetchMock.mockClear();
		expect(
			await runMetaWeeklyReview({
				now: new Date('2026-10-28T12:00:00Z'),
				fetchImpl: fetchMock,
			}),
		).toBe('skipped');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(
			await runMetaWeeklyReview({
				now: new Date('2026-11-02T12:00:00Z'),
				fetchImpl: fetchMock,
			}),
		).toBe('completed');
	});

	it('flags low quality and missing commercial health instead of declaring success', async () => {
		await runMetaWeeklyReview({ now, fetchImpl: fetchMock });
		const report = metaWeeklyReviewSchema.parse(stored);
		expect(metaReviewNeedsAttention(report)).toBe(false);
		for (const field of ['emq', 'coverage', 'dedupCoverage'] as const) {
			expect(
				metaReviewNeedsAttention({
					...report,
					quality: [{ ...report.quality![0], [field]: 0 }],
				}),
			).toBe(true);
		}
		expect(metaReviewNeedsAttention({ ...report, commercial: null })).toBe(true);
	});
	it('records missing source as unknown and still notifies about the available report', async () => {
		jest.mocked(loadMetaInsightsTable).mockRejectedValueOnce(new Error('private failure'));
		fetchMock.mockResolvedValueOnce(json({ error: { code: 200 } }, 403));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('completed');
		expect(stored).toMatchObject({ quality: null, insights: null, notice: 'sent' });
		expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).needsAttention).toBe(true);
	});
	it('retries failed notices with the same idempotency key without requerying Meta', async () => {
		fetchMock.mockResolvedValueOnce(json(quality)).mockResolvedValueOnce(json({}, 503));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
		fetchMock.mockClear();
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('completed');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0][0])).toContain('notify.example.test');
	});
	it.each(['', 'http://notify.example.test', 'https://user:pass@example.test'])(
		'rejects an unset or unsafe notice destination %s',
		async (target) => {
			jest.mocked(getEnv).mockImplementation((key) =>
				key === 'META_DATASET_QUALITY_ACCESS_TOKEN' ? token : target,
			);
			expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
			expect(fetchMock).toHaveBeenCalledTimes(1);
		},
	);
	it('does not notify if storage fails and does not log exception details', async () => {
		jest.mocked(supabaseRestRequest).mockRejectedValueOnce(new Error(token));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith('[meta-weekly-review] failed');
	});
	it('does not send a notice before a newly generated report is stored', async () => {
		jest.mocked(supabaseRestRequest)
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error(token));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0][0])).toContain('graph.facebook.com');
	});
	it('records redirected or timed out notices as failed without following them', async () => {
		fetchMock.mockResolvedValueOnce(json(quality)).mockResolvedValueOnce(json({}, 302));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
		expect(stored).toMatchObject({ notice: 'failed' });
		fetchMock.mockRejectedValueOnce(new Error('timeout'));
		expect(await runMetaWeeklyReview({ now, fetchImpl: fetchMock })).toBe('failed');
	});
	it('rejects corrupt persisted reports rather than trusting their shape', async () => {
		stored = { version: 1 };
		await expect(loadMetaWeeklyReview()).rejects.toThrow();
	});
});
