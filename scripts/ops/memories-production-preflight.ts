/**
 * Read-only Production preflight for one event memory space. It sends GET and
 * OPTIONS requests only: no session is created, nothing is reserved and nothing
 * is uploaded. Run it before the canary and again on the day the window opens.
 *
 * It answers one question: does a guest who scans the printed QR reach a page
 * that can talk to the app and to the upload Worker?
 */

import path from 'node:path';
import {
	MEMORIES_PUBLIC_ORIGIN,
	buildMemoriesGuestApiPath,
	buildMemoriesPublicPath,
	isMemoriesPublicSlug,
} from '../../src/lib/memories/contract/private-request';
import { MEMORIES_CANONICAL_APP_ORIGIN } from './memories-production-canary';

const REQUEST_TIMEOUT_MS = 15_000;
const UNKNOWN_SLUG = 'preflight-no-such-space';
const FOREIGN_ORIGIN = 'https://preflight.example.invalid';

export type PreflightInvocation = { slug: string; uploadOrigin: string | null };
export type PreflightResult = {
	check: string;
	status: 'PASS' | 'FAIL' | 'SKIPPED';
	detail: string;
};
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class PreflightArgumentError extends Error {}

export function parsePreflightInvocation(argv: readonly string[]): PreflightInvocation {
	const values = new Map<string, string>();
	for (const argument of argv[0] === '--' ? argv.slice(1) : argv) {
		const match = /^--([a-z-]+)=(.+)$/.exec(argument);
		if (!match) throw new PreflightArgumentError('INVALID_ARGUMENT');
		const [, key, value] = match;
		if (key !== 'slug' && key !== 'upload-origin')
			throw new PreflightArgumentError('UNKNOWN_ARGUMENT');
		if (values.has(key)) throw new PreflightArgumentError('DUPLICATE_ARGUMENT');
		values.set(key, value);
	}
	const slug = values.get('slug') ?? '';
	if (!isMemoriesPublicSlug(slug)) throw new PreflightArgumentError('INVALID_SLUG');
	const rawOrigin = values.get('upload-origin');
	if (!rawOrigin) return { slug, uploadOrigin: null };
	let origin: URL;
	try {
		origin = new URL(rawOrigin);
	} catch {
		throw new PreflightArgumentError('INVALID_UPLOAD_ORIGIN');
	}
	if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash)
		throw new PreflightArgumentError('INVALID_UPLOAD_ORIGIN');
	return { slug, uploadOrigin: origin.origin };
}

function result(check: string, passed: boolean, detail: string): PreflightResult {
	return { check, status: passed ? 'PASS' : 'FAIL', detail };
}

async function request(fetchImpl: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
	return fetchImpl(url, {
		redirect: 'manual',
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		...init,
	});
}

/** The printed QR points at the apex; only `www` is allowed to upload. */
async function checkApexRedirect(fetchImpl: Fetch, slug: string): Promise<PreflightResult> {
	const route = buildMemoriesPublicPath(slug);
	const response = await request(fetchImpl, `${MEMORIES_PUBLIC_ORIGIN}${route}`);
	const location = response.headers.get('location');
	const expected = `${MEMORIES_CANONICAL_APP_ORIGIN}${route}`;
	return result(
		'printed_qr_redirect',
		response.status >= 300 && response.status < 400 && location === expected,
		`status ${response.status}, location ${location === expected ? 'canonical' : 'unexpected'}`,
	);
}

async function checkGuestPage(fetchImpl: Fetch, slug: string): Promise<PreflightResult> {
	const response = await request(
		fetchImpl,
		`${MEMORIES_CANONICAL_APP_ORIGIN}${buildMemoriesPublicPath(slug)}`,
	);
	const body = response.status === 200 ? await response.text() : '';
	const cacheControl = response.headers.get('cache-control') ?? '';
	return result(
		'guest_page',
		response.status === 200 &&
			cacheControl.includes('no-store') &&
			body.includes('data-page="memories"'),
		`status ${response.status}, cache-control ${cacheControl.includes('no-store') ? 'no-store' : 'cacheable'}`,
	);
}

async function checkUnknownSlug(fetchImpl: Fetch): Promise<PreflightResult> {
	const response = await request(
		fetchImpl,
		`${MEMORIES_CANONICAL_APP_ORIGIN}${buildMemoriesPublicPath(UNKNOWN_SLUG)}`,
	);
	return result(
		'unknown_slug_fails_closed',
		response.status === 404,
		`status ${response.status}`,
	);
}

/** Without a cookie the session route only reads: it proves the app reaches its database. */
async function checkGuestApi(fetchImpl: Fetch, slug: string): Promise<PreflightResult> {
	const response = await request(
		fetchImpl,
		`${MEMORIES_CANONICAL_APP_ORIGIN}${buildMemoriesGuestApiPath(slug)}/session`,
		{ headers: { Accept: 'application/json' } },
	);
	const payload: unknown =
		response.status === 200 ? await response.json().catch(() => null) : null;
	const anonymous =
		typeof payload === 'object' &&
		payload !== null &&
		(payload as { profile?: unknown }).profile === null;
	return result(
		'guest_api',
		response.status === 200 && anonymous,
		`status ${response.status}${response.status === 200 && !anonymous ? ', unexpected body' : ''}`,
	);
}

/** The CORS preflight the browser sends before the PUT; it never reaches storage. */
async function checkUploadWorker(
	fetchImpl: Fetch,
	uploadOrigin: string,
): Promise<PreflightResult[]> {
	const preflight = (origin: string) =>
		request(fetchImpl, `${uploadOrigin}/upload`, {
			method: 'OPTIONS',
			headers: {
				Origin: origin,
				'Access-Control-Request-Method': 'PUT',
				'Access-Control-Request-Headers':
					'authorization,content-type,x-amz-checksum-sha256',
			},
		});
	const allowed = await preflight(MEMORIES_CANONICAL_APP_ORIGIN);
	const foreign = await preflight(FOREIGN_ORIGIN);
	const allowedOrigin = allowed.headers.get('access-control-allow-origin');
	return [
		result(
			'upload_worker_accepts_app_origin',
			allowed.status === 204 && allowedOrigin === MEMORIES_CANONICAL_APP_ORIGIN,
			`status ${allowed.status}, allow-origin ${allowedOrigin === MEMORIES_CANONICAL_APP_ORIGIN ? 'canonical' : 'unexpected'}`,
		),
		result(
			'upload_worker_rejects_other_origins',
			foreign.status === 403,
			`status ${foreign.status}`,
		),
	];
}

async function guarded(
	check: string,
	run: () => Promise<PreflightResult | PreflightResult[]>,
): Promise<PreflightResult[]> {
	try {
		const outcome = await run();
		return Array.isArray(outcome) ? outcome : [outcome];
	} catch {
		return [{ check, status: 'FAIL', detail: 'request failed or timed out' }];
	}
}

export async function runMemoriesPreflight(
	invocation: PreflightInvocation,
	fetchImpl: Fetch = fetch,
): Promise<PreflightResult[]> {
	const { slug, uploadOrigin } = invocation;
	return [
		...(await guarded('printed_qr_redirect', () => checkApexRedirect(fetchImpl, slug))),
		...(await guarded('guest_page', () => checkGuestPage(fetchImpl, slug))),
		...(await guarded('unknown_slug_fails_closed', () => checkUnknownSlug(fetchImpl))),
		...(await guarded('guest_api', () => checkGuestApi(fetchImpl, slug))),
		...(uploadOrigin
			? await guarded('upload_worker', () => checkUploadWorker(fetchImpl, uploadOrigin))
			: [
					{
						check: 'upload_worker',
						status: 'SKIPPED' as const,
						detail: 'pass --upload-origin=<Sign Worker origin> to check it',
					},
				]),
	];
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
	let invocation: PreflightInvocation;
	try {
		invocation = parsePreflightInvocation(argv);
	} catch (error) {
		console.error(
			JSON.stringify({
				check: 'arguments',
				status: 'FAIL',
				detail:
					error instanceof PreflightArgumentError ? error.message : 'INVALID_ARGUMENT',
			}),
		);
		process.exitCode = 1;
		return;
	}
	const results = await runMemoriesPreflight(invocation);
	for (const entry of results) console.log(JSON.stringify(entry));
	const failed = results.some((entry) => entry.status === 'FAIL');
	console.log(JSON.stringify({ check: 'result', status: failed ? 'FAIL' : 'PASS', detail: '' }));
	if (failed) process.exitCode = 1;
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (
	entryArg.endsWith(`${path.sep}memories-production-preflight.ts`) ||
	entryArg.endsWith(`${path.sep}memories-production-preflight.js`)
) {
	void main();
}
