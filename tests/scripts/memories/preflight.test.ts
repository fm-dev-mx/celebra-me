import {
	PreflightArgumentError,
	parsePreflightInvocation,
	runMemoriesPreflight,
} from '../../../scripts/ops/memories-production-preflight';

const SLUG = 'victoria-y-roberto';
const APEX = `https://celebra-me.com/r/${SLUG}`;
const WWW = `https://www.celebra-me.com/r/${SLUG}`;
const UPLOAD_ORIGIN = 'https://memories-sign.example.workers.dev';

type Call = { url: string; method: string; origin: string | null };

function respond(status: number, init: { headers?: Record<string, string>; body?: string } = {}) {
	return new Response(status === 204 ? null : (init.body ?? ''), {
		status,
		headers: init.headers,
	});
}

/** A healthy deployment, with per-URL overrides for the failure cases. */
function fakeFetch(overrides: Record<string, () => Response> = {}) {
	const calls: Call[] = [];
	const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
		const headers = new Headers(init?.headers);
		const method = init?.method ?? 'GET';
		const origin = headers.get('origin');
		calls.push({ url, method, origin });
		const override = overrides[`${method} ${url}`];
		if (override) return override();
		if (url === APEX) return respond(307, { headers: { location: WWW } });
		if (url === WWW)
			return respond(200, {
				headers: { 'cache-control': 'no-store, private' },
				body: '<main data-page="memories"></main>',
			});
		if (url.endsWith('/r/preflight-no-such-space')) return respond(404);
		if (url.endsWith(`/api/memories/${SLUG}/session`))
			return respond(200, { body: JSON.stringify({ profile: null }) });
		if (url === `${UPLOAD_ORIGIN}/upload`) {
			return origin === 'https://www.celebra-me.com'
				? respond(204, { headers: { 'access-control-allow-origin': origin } })
				: respond(403);
		}
		return respond(500);
	};
	return { fetchImpl, calls };
}

function statuses(results: Awaited<ReturnType<typeof runMemoriesPreflight>>) {
	return Object.fromEntries(results.map((entry) => [entry.check, entry.status]));
}

describe('memories Production preflight arguments', () => {
	it('accepts a slug alone or with the Sign Worker origin', () => {
		expect(parsePreflightInvocation([`--slug=${SLUG}`])).toEqual({
			slug: SLUG,
			uploadOrigin: null,
		});
		expect(
			parsePreflightInvocation(['--', `--slug=${SLUG}`, `--upload-origin=${UPLOAD_ORIGIN}/`]),
		).toEqual({ slug: SLUG, uploadOrigin: UPLOAD_ORIGIN });
	});

	it.each([
		[['--slug=Not A Slug'], 'INVALID_SLUG'],
		[[], 'INVALID_SLUG'],
		[[`--slug=${SLUG}`, '--force=yes'], 'UNKNOWN_ARGUMENT'],
		[[`--slug=${SLUG}`, `--slug=${SLUG}`], 'DUPLICATE_ARGUMENT'],
		[[`--slug=${SLUG}`, 'extra'], 'INVALID_ARGUMENT'],
		[[`--slug=${SLUG}`, '--upload-origin=http://insecure.example'], 'INVALID_UPLOAD_ORIGIN'],
		[[`--slug=${SLUG}`, `--upload-origin=${UPLOAD_ORIGIN}/upload`], 'INVALID_UPLOAD_ORIGIN'],
		[[`--slug=${SLUG}`, '--upload-origin=not-a-url'], 'INVALID_UPLOAD_ORIGIN'],
	])('rejects %j with %s', (argv, code) => {
		expect(() => parsePreflightInvocation(argv)).toThrow(PreflightArgumentError);
		expect(() => parsePreflightInvocation(argv)).toThrow(code);
	});
});

describe('memories Production preflight checks', () => {
	it('passes a healthy deployment and only ever reads', async () => {
		const { fetchImpl, calls } = fakeFetch();

		const results = await runMemoriesPreflight(
			{ slug: SLUG, uploadOrigin: UPLOAD_ORIGIN },
			fetchImpl,
		);

		expect(statuses(results)).toEqual({
			printed_qr_redirect: 'PASS',
			guest_page: 'PASS',
			unknown_slug_fails_closed: 'PASS',
			guest_api: 'PASS',
			upload_worker_accepts_app_origin: 'PASS',
			upload_worker_rejects_other_origins: 'PASS',
		});
		expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET', 'OPTIONS']));
	});

	it('skips the Worker check when its origin is not given', async () => {
		const { fetchImpl, calls } = fakeFetch();

		const results = await runMemoriesPreflight({ slug: SLUG, uploadOrigin: null }, fetchImpl);

		expect(statuses(results).upload_worker).toBe('SKIPPED');
		expect(calls.every((call) => call.method === 'GET')).toBe(true);
	});

	it.each([
		[
			'the apex stops redirecting to www',
			{ [`GET ${APEX}`]: () => respond(200) },
			'printed_qr_redirect',
		],
		[
			'the apex redirect drops the path',
			{
				[`GET ${APEX}`]: () =>
					respond(307, { headers: { location: 'https://www.celebra-me.com/' } }),
			},
			'printed_qr_redirect',
		],
		['the space page is not reachable', { [`GET ${WWW}`]: () => respond(404) }, 'guest_page'],
		[
			'the space page fails on the server',
			{ [`GET ${WWW}`]: () => respond(500) },
			'guest_page',
		],
		[
			'the space page became cacheable',
			{
				[`GET ${WWW}`]: () =>
					respond(200, {
						headers: { 'cache-control': 'public, max-age=60' },
						body: '<main data-page="memories"></main>',
					}),
			},
			'guest_page',
		],
		[
			'the guest API cannot reach its database',
			{
				[`GET https://www.celebra-me.com/api/memories/${SLUG}/session`]: () => respond(500),
			},
			'guest_api',
		],
		[
			'the Worker does not list the app origin',
			{ [`OPTIONS ${UPLOAD_ORIGIN}/upload`]: () => respond(403) },
			'upload_worker_accepts_app_origin',
		],
	])('fails when %s', async (_label, overrides, failingCheck) => {
		const { fetchImpl } = fakeFetch(overrides);

		const results = await runMemoriesPreflight(
			{ slug: SLUG, uploadOrigin: UPLOAD_ORIGIN },
			fetchImpl,
		);

		expect(statuses(results)[failingCheck]).toBe('FAIL');
	});

	it('reports a network failure as a failed check instead of throwing', async () => {
		const results = await runMemoriesPreflight({ slug: SLUG, uploadOrigin: null }, async () => {
			throw new TypeError('fetch failed');
		});

		expect(results.filter((entry) => entry.status === 'FAIL')).toHaveLength(4);
		expect(results.every((entry) => !entry.detail.includes('fetch failed'))).toBe(true);
	});
});
