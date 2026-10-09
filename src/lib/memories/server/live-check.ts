/**
 * Read-only reachability checks for one memory space: GET and OPTIONS requests
 * only, so no session is created, nothing is reserved and nothing is uploaded.
 * Shared by the owner's Production preflight script and the super-admin
 * diagnostics panel; the caller decides which origins stand for the app.
 */

import {
	buildMemoriesGuestApiPath,
	buildMemoriesPublicPath,
} from '@/lib/memories/contract/private-request';
import type { MemoriesLiveCheck } from '@/lib/memories/contract/catalog';

const REQUEST_TIMEOUT_MS = 15_000;
const UNKNOWN_SLUG = 'preflight-no-such-space';
const FOREIGN_ORIGIN = 'https://preflight.example.invalid';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface MemoriesLiveCheckTarget {
	slug: string;
	/** Origin that serves the guest page and API (and that the Sign Worker allows). */
	appOrigin: string;
	/** Origin printed on the QR when it differs from `appOrigin`; it must redirect there. */
	qrOrigin: string | null;
	/** Sign Worker origin; null skips the upload checks. */
	uploadOrigin: string | null;
	/** Shown when the upload checks are skipped. */
	uploadSkipDetail?: string;
}

function result(check: string, passed: boolean, detail: string): MemoriesLiveCheck {
	return { check, status: passed ? 'PASS' : 'FAIL', detail };
}

async function request(fetchImpl: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
	return fetchImpl(url, {
		redirect: 'manual',
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		...init,
	});
}

/** The printed QR points at the QR origin; only the app origin is allowed to upload. */
async function checkQrRedirect(
	fetchImpl: Fetch,
	target: MemoriesLiveCheckTarget & { qrOrigin: string },
): Promise<MemoriesLiveCheck> {
	const route = buildMemoriesPublicPath(target.slug);
	const response = await request(fetchImpl, `${target.qrOrigin}${route}`);
	const location = response.headers.get('location');
	const expected = `${target.appOrigin}${route}`;
	return result(
		'printed_qr_redirect',
		response.status >= 300 && response.status < 400 && location === expected,
		`status ${response.status}, location ${location === expected ? 'canonical' : 'unexpected'}`,
	);
}

async function checkGuestPage(
	fetchImpl: Fetch,
	target: MemoriesLiveCheckTarget,
): Promise<MemoriesLiveCheck> {
	const response = await request(
		fetchImpl,
		`${target.appOrigin}${buildMemoriesPublicPath(target.slug)}`,
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

async function checkUnknownSlug(
	fetchImpl: Fetch,
	target: MemoriesLiveCheckTarget,
): Promise<MemoriesLiveCheck> {
	const response = await request(
		fetchImpl,
		`${target.appOrigin}${buildMemoriesPublicPath(UNKNOWN_SLUG)}`,
	);
	return result(
		'unknown_slug_fails_closed',
		response.status === 404,
		`status ${response.status}`,
	);
}

/** Without a cookie the session route only reads: it proves the app reaches its database. */
async function checkGuestApi(
	fetchImpl: Fetch,
	target: MemoriesLiveCheckTarget,
): Promise<MemoriesLiveCheck> {
	const response = await request(
		fetchImpl,
		`${target.appOrigin}${buildMemoriesGuestApiPath(target.slug)}/session`,
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
	appOrigin: string,
	uploadOrigin: string,
): Promise<MemoriesLiveCheck[]> {
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
	const allowed = await preflight(appOrigin);
	const foreign = await preflight(FOREIGN_ORIGIN);
	const allowedOrigin = allowed.headers.get('access-control-allow-origin');
	return [
		result(
			'upload_worker_accepts_app_origin',
			allowed.status === 204 && allowedOrigin === appOrigin,
			`status ${allowed.status}, allow-origin ${allowedOrigin === appOrigin ? 'canonical' : 'unexpected'}`,
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
	run: () => Promise<MemoriesLiveCheck | MemoriesLiveCheck[]>,
): Promise<MemoriesLiveCheck[]> {
	try {
		const outcome = await run();
		return Array.isArray(outcome) ? outcome : [outcome];
	} catch {
		return [{ check, status: 'FAIL', detail: 'request failed or timed out' }];
	}
}

export async function runMemoriesLiveChecks(
	target: MemoriesLiveCheckTarget,
	fetchImpl: Fetch = fetch,
): Promise<MemoriesLiveCheck[]> {
	const { qrOrigin, uploadOrigin } = target;
	return [
		...(qrOrigin
			? await guarded('printed_qr_redirect', () =>
					checkQrRedirect(fetchImpl, { ...target, qrOrigin }),
				)
			: []),
		...(await guarded('guest_page', () => checkGuestPage(fetchImpl, target))),
		...(await guarded('unknown_slug_fails_closed', () => checkUnknownSlug(fetchImpl, target))),
		...(await guarded('guest_api', () => checkGuestApi(fetchImpl, target))),
		...(uploadOrigin
			? await guarded('upload_worker', () =>
					checkUploadWorker(fetchImpl, target.appOrigin, uploadOrigin),
				)
			: [
					{
						check: 'upload_worker',
						status: 'SKIPPED' as const,
						detail: target.uploadSkipDetail ?? 'upload origin not configured',
					},
				]),
	];
}
