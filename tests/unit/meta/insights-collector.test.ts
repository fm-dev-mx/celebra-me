/** @jest-environment node */
import { runMetaInsightsCollector, normalizeAdAccountId } from '@/lib/meta/insights-collector';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { getEnv } from '@/lib/server/env';

jest.mock('@/lib/server/env', () => ({ getEnv: jest.fn(() => '') }));
jest.mock('@/lib/rsvp/repositories/supabase', () => ({
	...jest.requireActual('@/lib/rsvp/repositories/supabase'),
	supabaseRestRequest: jest.fn(),
}));

const TOKEN = 'synthetic-secret-token';
const NOW = new Date('2026-10-25T10:43:00Z');
const DAY = '2026-10-24';
const ENV: Record<string, string> = {
	META_GRAPH_ACCESS_TOKEN: TOKEN,
	META_AD_ACCOUNT_ID: 'act_111',
	META_PAGE_ID: '222',
	META_IG_USER_ID: '333',
};
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(body), { status, headers });

const upsertMock = jest.mocked(supabaseRestRequest);

function useEnv(values: Record<string, string>) {
	jest.mocked(getEnv).mockImplementation((key: string) => values[key] ?? '');
}

/** Answers each Graph path with a fixed body; records the requested URLs. */
function graph(bodies: Record<string, () => Response>) {
	const urls: URL[] = [];
	const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		urls.push(url);
		const key = Object.keys(bodies).find((path) => url.pathname.endsWith(path));
		if (!key) throw new Error(`unexpected ${url.pathname}`);
		return bodies[key]();
	}) as unknown as typeof fetch;
	return { fetchImpl, urls };
}

const healthy = () =>
	graph({
		'act_111/insights': () =>
			json({
				data: [
					{
						campaign_id: 'c1',
						campaign_name: 'XV primavera',
						spend: '120.50',
						impressions: '3000',
						clicks: '42',
						account_currency: 'MXN',
						date_start: DAY,
					},
					{
						campaign_id: 'c2',
						spend: '9.5',
						impressions: '100',
						clicks: '1',
						date_start: DAY,
					},
				],
			}),
		'222/insights': () =>
			json({
				data: [
					{
						name: 'page_total_media_view_unique',
						period: 'day',
						values: [{ value: 870, end_time: '2026-10-25T07:00:00+0000' }],
					},
				],
			}),
		'333/insights': () =>
			json({ data: [{ name: 'reach', period: 'day', total_value: { value: 455 } }] }),
	});

describe('runMetaInsightsCollector', () => {
	beforeEach(() => {
		upsertMock.mockReset();
		upsertMock.mockResolvedValue([]);
		useEnv(ENV);
	});

	it('collects the last completed day and upserts every source by its table keys', async () => {
		const { fetchImpl, urls } = healthy();
		const result = await runMetaInsightsCollector({ now: NOW, fetchImpl });

		expect(result).toEqual({
			status: 'completed',
			date: DAY,
			sources: {
				ads: { status: 'completed', rows: 2 },
				page: { status: 'completed', rows: 1 },
				instagram: { status: 'completed', rows: 1 },
			},
			missingConfig: [],
		});
		// The account id already carries `act_`; it is never doubled.
		expect(urls[0].pathname).toBe('/v26.0/act_111/insights');
		expect(urls[0].searchParams.get('time_range')).toBe(
			JSON.stringify({ since: DAY, until: DAY }),
		);
		expect(urls[1].searchParams.get('metric')).toBe('page_total_media_view_unique');
		expect(urls[2].searchParams.get('metric_type')).toBe('total_value');
		expect(urls.every((url) => !url.href.includes(TOKEN))).toBe(true);

		const [ads, page, ig] = upsertMock.mock.calls.map(([options]) => options);
		expect(ads.pathWithQuery).toBe(
			'meta_ads_insights_daily?on_conflict=account_id,level,object_id,insight_date,attribution_window',
		);
		expect(ads.prefer).toBe('resolution=merge-duplicates,return=minimal');
		expect(ads.useServiceRole).toBe(true);
		expect(ads.body).toEqual([
			expect.objectContaining({
				account_id: 'act_111',
				level: 'campaign',
				object_id: 'c1',
				insight_date: DAY,
				attribution_window: 'unified',
				raw: {
					campaign_name: 'XV primavera',
					currency: 'MXN',
					spend: 120.5,
					impressions: 3000,
					clicks: 42,
				},
				collected_at: NOW.toISOString(),
			}),
			expect.objectContaining({
				object_id: 'c2',
				raw: expect.objectContaining({ spend: 9.5 }),
			}),
		]);
		expect(page.pathWithQuery).toBe(
			'meta_organic_insights_daily?on_conflict=platform,account_id,level,object_id,insight_date,metric_period',
		);
		expect(page.body).toEqual([
			expect.objectContaining({
				platform: 'facebook',
				level: 'page',
				object_id: '222',
				metric_period: 'day',
				raw: { page_total_media_view_unique: 870 },
			}),
		]);
		expect(ig.body).toEqual([
			expect.objectContaining({
				platform: 'instagram',
				level: 'ig_user',
				raw: { reach: 455 },
			}),
		]);
	});

	it('re-running the same day writes the same keys again instead of new rows', async () => {
		const first = healthy();
		await runMetaInsightsCollector({ now: NOW, fetchImpl: first.fetchImpl });
		const firstBodies = upsertMock.mock.calls.map(([options]) => options.body);
		upsertMock.mockClear();

		const later = new Date('2026-10-25T18:00:00Z');
		const second = healthy();
		const result = await runMetaInsightsCollector({
			now: later,
			date: DAY,
			fetchImpl: second.fetchImpl,
		});

		expect(result.status).toBe('completed');
		const keys = (bodies: unknown[]) =>
			bodies.flatMap((body) =>
				(body as Record<string, unknown>[]).map(
					({ raw: _raw, collected_at: _at, ...key }) => key,
				),
			);
		expect(keys(upsertMock.mock.calls.map(([options]) => options.body))).toEqual(
			keys(firstBodies),
		);
		expect(
			upsertMock.mock.calls.every(([options]) =>
				(options.pathWithQuery ?? '').includes('on_conflict='),
			),
		).toBe(true);
		// The refreshed rows carry the new collection time.
		expect(
			(upsertMock.mock.calls[0][0].body as { collected_at: string }[])[0].collected_at,
		).toBe(later.toISOString());
	});

	it('skips without calling Meta or storage when the token is missing', async () => {
		useEnv({ ...ENV, META_GRAPH_ACCESS_TOKEN: '' });
		const { fetchImpl } = healthy();
		const result = await runMetaInsightsCollector({ now: NOW, fetchImpl });

		expect(result.status).toBe('skipped');
		expect(result.sources.ads).toEqual({ status: 'skipped', reason: 'missing_config' });
		expect(result.missingConfig).toEqual(['META_GRAPH_ACCESS_TOKEN']);
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(upsertMock).not.toHaveBeenCalled();
	});

	it('skips only the source whose id is missing or malformed', async () => {
		useEnv({ ...ENV, META_PAGE_ID: '', META_AD_ACCOUNT_ID: 'act_act_111' });
		const { fetchImpl, urls } = healthy();
		const result = await runMetaInsightsCollector({ now: NOW, fetchImpl });

		expect(result.status).toBe('completed');
		expect(result.sources.ads).toEqual({ status: 'skipped', reason: 'invalid_config' });
		expect(result.sources.page).toEqual({ status: 'skipped', reason: 'missing_config' });
		expect(result.sources.instagram).toEqual({ status: 'completed', rows: 1 });
		expect(result.missingConfig).toEqual(['META_PAGE_ID']);
		expect(urls.map((url) => url.pathname)).toEqual(['/v26.0/333/insights']);
	});

	it('reports a usage limit without sleeping, leaking the token or failing other sources', async () => {
		const { fetchImpl } = graph({
			...{
				'act_111/insights': () =>
					json({ error: { code: 17, message: `limit for ${TOKEN}` } }, 400, {
						'retry-after': '120',
					}),
			},
			'222/insights': () =>
				json({ data: [{ name: 'page_total_media_view_unique', values: [{ value: 5 }] }] }),
			'333/insights': () => json({ data: [{ name: 'reach', total_value: { value: 7 } }] }),
		});
		const result = await runMetaInsightsCollector({ now: NOW, fetchImpl });

		expect(result.status).toBe('failed');
		expect(result.sources.ads).toEqual({
			status: 'failed',
			kind: 'rate_limit',
			// The client defers long waits with a fresh error that carries only the delay.
			httpStatus: null,
			code: null,
			retryAfterMs: 120_000,
		});
		expect(result.sources.page).toEqual({ status: 'completed', rows: 1 });
		expect(result.sources.instagram).toEqual({ status: 'completed', rows: 1 });
		expect(JSON.stringify(result)).not.toContain(TOKEN);
		expect(JSON.stringify(result)).not.toContain('graph.facebook.com');
		// Nothing partial is written for the limited source.
		expect(upsertMock.mock.calls.map(([options]) => options.pathWithQuery)).not.toContainEqual(
			expect.stringContaining('meta_ads_insights_daily'),
		);
	});

	it('rejects rows for another day and reports storage failures by status only', async () => {
		const { fetchImpl } = graph({
			'act_111/insights': () =>
				json({ data: [{ campaign_id: 'c1', spend: '1', date_start: '2026-10-23' }] }),
			'222/insights': () =>
				json({ data: [{ name: 'page_total_media_view_unique', values: [{ value: 5 }] }] }),
			'333/insights': () => json({ data: [{ name: 'reach', total_value: { value: 7 } }] }),
		});
		upsertMock.mockRejectedValueOnce(new SupabaseHttpError(503, 'down', 'PGRST000'));
		const result = await runMetaInsightsCollector({ now: NOW, fetchImpl });

		expect(result.sources.ads).toEqual(
			expect.objectContaining({ status: 'failed', kind: 'response' }),
		);
		expect(result.sources.page).toEqual({
			status: 'failed',
			kind: 'storage',
			httpStatus: 503,
			code: null,
			retryAfterMs: null,
		});
		expect(result.sources.instagram).toEqual({ status: 'completed', rows: 1 });
	});
});

describe('normalizeAdAccountId', () => {
	it('keeps the act_ prefix once and rejects anything else', () => {
		expect(normalizeAdAccountId(' act_123 ')).toBe('act_123');
		expect(normalizeAdAccountId('123')).toBe('act_123');
		expect(normalizeAdAccountId('act_act_123')).toBeNull();
		expect(normalizeAdAccountId('act_12/../x')).toBeNull();
	});
});
