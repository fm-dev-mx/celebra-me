/** @jest-environment node */
import {
	MetaGraphClient,
	MetaGraphError,
	META_GRAPH_API_VERSION,
	readMetaInsightsConfig,
} from '@/lib/meta/graph-client';
import { getEnv } from '@/lib/server/env';

jest.mock('@/lib/server/env', () => ({ getEnv: jest.fn(() => '') }));

const TOKEN = 'synthetic-secret-token';
const PATH = 'act_123/insights';
const ENDPOINT = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${PATH}`;
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(body), { status, headers });

async function collect(client: MetaGraphClient, params?: Record<string, string>) {
	const rows: Record<string, unknown>[] = [];
	for await (const page of client.pages(PATH, params)) rows.push(...page);
	return rows;
}

describe('Meta aggregate insight transport', () => {
	let fetchMock: jest.MockedFunction<typeof fetch>;
	let client: MetaGraphClient;
	beforeEach(() => {
		jest.useFakeTimers();
		fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
		client = new MetaGraphClient({ accessToken: TOKEN, fetchImpl: fetchMock });
	});
	afterEach(() => jest.useRealTimers());

	it('reads only the four runtime names when explicitly requested', () => {
		jest.mocked(getEnv).mockClear();
		expect(readMetaInsightsConfig()).toEqual({
			accessToken: '',
			adAccountId: '',
			pageId: '',
			igUserId: '',
		});
		expect(jest.mocked(getEnv).mock.calls.map(([key]) => key)).toEqual([
			'META_GRAPH_ACCESS_TOKEN',
			'META_AD_ACCOUNT_ID',
			'META_PAGE_ID',
			'META_IG_USER_ID',
		]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('pins the version and sends credentials only in the bearer header', async () => {
		fetchMock.mockResolvedValue(json({ data: [{ spend: '12.50' }] }));
		await expect(collect(client, { fields: 'spend', time_increment: '1' })).resolves.toEqual([
			{ spend: '12.50' },
		]);
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe(`${ENDPOINT}?fields=spend&time_increment=1`);
		expect(String(url)).not.toContain(TOKEN);
		expect(init).toMatchObject({
			method: 'GET',
			redirect: 'manual',
			cache: 'no-store',
			headers: { Authorization: `Bearer ${TOKEN}` },
		});
	});

	it('follows next even after an empty page, stripping embedded credentials', async () => {
		fetchMock
			.mockResolvedValueOnce(
				json({
					data: [],
					paging: {
						next: `${ENDPOINT}?after=cursor&access_token=${TOKEN}&appsecret_proof=proof`,
					},
				}),
			)
			.mockResolvedValueOnce(json({ data: [{ reach: 5 }] }));
		await expect(collect(client)).resolves.toEqual([{ reach: 5 }]);
		expect(fetchMock.mock.calls[1][0]).toBe(`${ENDPOINT}?after=cursor`);
	});

	it.each([
		'https://attacker.example/insights',
		`http://graph.facebook.com/${META_GRAPH_API_VERSION}/${PATH}`,
		`https://graph.facebook.com/v19.0/${PATH}`,
		`https://graph.facebook.com/${META_GRAPH_API_VERSION}/other/insights`,
		`https://user:password@graph.facebook.com/${META_GRAPH_API_VERSION}/${PATH}`,
		'not a URL',
	])('rejects untrusted pagination without another request: %s', async (next) => {
		fetchMock.mockResolvedValueOnce(json({ data: [], paging: { next } }));
		await expect(collect(client)).rejects.toMatchObject({ kind: 'pagination' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('stops repeated pages and fails explicitly at the page budget', async () => {
		fetchMock.mockResolvedValue(json({ data: [], paging: { next: ENDPOINT } }));
		await expect(collect(client)).rejects.toMatchObject({ kind: 'pagination' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		client = new MetaGraphClient({ accessToken: TOKEN, fetchImpl: fetchMock, maxPages: 1 });
		fetchMock.mockResolvedValue(json({ data: [], paging: { next: `${ENDPOINT}?after=next` } }));
		await expect(collect(client)).rejects.toMatchObject({ kind: 'pagination' });
	});

	it('redacts provider errors including HTTP 200 error envelopes and does not retry authorization failures', async () => {
		fetchMock.mockResolvedValue(
			json({ error: { code: 190, message: `Invalid token ${TOKEN}` } }),
		);
		const error = await collect(client).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(MetaGraphError);
		expect(error).toMatchObject({ kind: 'response', code: 190 });
		expect(`${String(error)} ${JSON.stringify(error)}`).not.toContain(TOKEN);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('refuses a redirect without following or retrying it', async () => {
		fetchMock.mockResolvedValue(
			new Response(null, { status: 302, headers: { location: 'https://example.com/' } }),
		);
		await expect(collect(client)).rejects.toMatchObject({ kind: 'response', status: 302 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('refuses an opaque redirect, as a browser-style fetch reports it', async () => {
		// `new Response` cannot build type 'opaqueredirect', so the mock is shaped by hand.
		fetchMock.mockResolvedValue({
			type: 'opaqueredirect',
			status: 0,
			ok: false,
			body: null,
		} as unknown as Response);
		await expect(collect(client)).rejects.toMatchObject({ kind: 'response', status: 0 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
	it('never preserves network error messages or causes', async () => {
		fetchMock.mockRejectedValue(
			new Error(`Connection failed ${ENDPOINT}?access_token=${TOKEN}`),
		);
		const error = await collect(client).catch((caught: unknown) => caught);
		expect(error).toMatchObject({ kind: 'network' });
		expect(`${String(error)} ${JSON.stringify(error)}`).not.toContain(TOKEN);
		expect(error).not.toHaveProperty('cause');
	});

	it.each([
		{ data: {} },
		{ data: [null] },
		{ data: [], paging: 'invalid' },
		{ data: [], paging: { next: 2 } },
	])('rejects malformed insight pages', async (body) => {
		fetchMock.mockResolvedValue(json(body));
		await expect(collect(client)).rejects.toBeInstanceOf(MetaGraphError);
	});

	it('honors Retry-After before retrying a rate limit', async () => {
		fetchMock
			.mockResolvedValueOnce(json({ error: { code: 4 } }, 429, { 'Retry-After': '2' }))
			.mockResolvedValueOnce(json({ data: [] }));
		const result = collect(client);
		await jest.advanceTimersByTimeAsync(1999);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await jest.advanceTimersByTimeAsync(1);
		await expect(result).resolves.toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('honors business recovery estimates in minutes without a long Worker sleep', async () => {
		fetchMock.mockResolvedValue(
			json({ error: { code: 17 } }, 400, {
				'X-Business-Use-Case-Usage': JSON.stringify({
					business: [{ estimated_time_to_regain_access: 2 }],
				}),
			}),
		);
		await expect(collect(client)).rejects.toMatchObject({
			kind: 'rate_limit',
			retryAfterMs: 120_000,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('defers pagination at full usage instead of ignoring a successful response header', async () => {
		fetchMock.mockResolvedValueOnce(
			json({ data: [], paging: { next: `${ENDPOINT}?after=next` } }, 200, {
				'X-App-Usage': JSON.stringify({ total_time: 100 }),
			}),
		);
		await expect(collect(client)).rejects.toMatchObject({
			kind: 'rate_limit',
			retryAfterMs: 60_000,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it.each(['X-App-Usage', 'X-Ad-Account-Usage'])(
		'backs off between successful pages using %s',
		async (header) => {
			fetchMock
				.mockResolvedValueOnce(
					json({ data: [], paging: { next: `${ENDPOINT}?after=next` } }, 200, {
						[header]: JSON.stringify({ call_count: 91, acc_id_util_pct: 91 }),
					}),
				)
				.mockResolvedValueOnce(json({ data: [{ reach: 7 }] }));
			const result = collect(client);
			await jest.advanceTimersByTimeAsync(999);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			await jest.advanceTimersByTimeAsync(1);
			await expect(result).resolves.toEqual([{ reach: 7 }]);
		},
	);

	it('bounds retries on persistent server errors and tolerates malformed usage headers', async () => {
		fetchMock.mockResolvedValue(json({}, 503, { 'X-App-Usage': 'invalid json' }));
		const result = expect(collect(client)).rejects.toMatchObject({
			kind: 'response',
			status: 503,
		});
		await jest.runAllTimersAsync();
		await result;
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it.each(['connection', 'body'])('times out and aborts the %s phase', async (phase) => {
		if (phase === 'connection') fetchMock.mockImplementation(() => new Promise(() => {}));
		else
			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: () => new Promise(() => {}),
			} as Response);
		const result = expect(collect(client)).rejects.toMatchObject({ kind: 'timeout' });
		await jest.advanceTimersByTimeAsync(10_000);
		await result;
		expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('rejects credential query parameters and non-insight paths before fetch', async () => {
		await expect(collect(client, { access_token: TOKEN })).rejects.toMatchObject({
			kind: 'request',
		});
		await expect(collect(client, { after: TOKEN })).rejects.toMatchObject({ kind: 'request' });
		await expect(client.pages('https://attacker.example').next()).rejects.toMatchObject({
			kind: 'request',
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects unbounded configuration', () => {
		expect(() => new MetaGraphClient({ accessToken: TOKEN, maxRetries: Infinity })).toThrow(
			MetaGraphError,
		);
		expect(() => new MetaGraphClient({ accessToken: TOKEN, maxPages: 0 })).toThrow(
			MetaGraphError,
		);
		expect(() => new MetaGraphClient({ accessToken: TOKEN, timeoutMs: NaN })).toThrow(
			MetaGraphError,
		);
	});
});
