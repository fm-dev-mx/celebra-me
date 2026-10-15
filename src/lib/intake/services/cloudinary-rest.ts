/**
 * Minimal Cloudinary REST client (server-only).
 *
 * Replaces the `cloudinary` npm SDK for the two calls the app makes: read one resource
 * through the Admin API and upload one image through the Upload API. It only needs
 * `fetch`, `FormData` and `node:crypto` (`createHash`), so it runs on Node and on
 * Workers with `nodejs_compat` alike.
 *
 * Signature parity with the SDK (signature version 2, SHA-1): every non-blank
 * parameter except `file`, `api_key`, `resource_type`, `cloud_name` and `signature`
 * is rendered as `key=value`, `&` inside a pair is encoded as `%26`, pairs are sorted
 * by key, joined with `&` and the API secret is appended before hashing.
 */
import { createHash } from 'node:crypto';

export interface CloudinaryRestConfig {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
}

export type CloudinaryParamValue = string | number | boolean | readonly string[] | undefined | null;
export type CloudinaryParams = Record<string, CloudinaryParamValue>;

/** Error shape the rest of the module keys on: `http_code` on the root, never the request. */
export class CloudinaryApiError extends Error {
	readonly http_code: number | undefined;

	constructor(status: number | undefined, message?: string) {
		super(
			message ??
				(status ? `Cloudinary API HTTP ${status}` : 'Cloudinary API request failed.'),
		);
		this.name = 'CloudinaryApiError';
		this.http_code = status;
	}
}

const UNSIGNED_PARAMS = new Set(['file', 'api_key', 'resource_type', 'cloud_name', 'signature']);
const REQUEST_TIMEOUT_MS = 30_000;

function renderParamValue(value: CloudinaryParamValue): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value)) return value.join(',');
	// The SDK sends booleans as 1/0 and signs the same representation.
	if (value === true) return '1';
	if (value === false) return '0';
	const rendered = String(value);
	return rendered === '' ? undefined : rendered;
}

/** Sorted `key=value&key=value` string the Cloudinary signature is computed over. */
export function buildCloudinarySignatureString(params: CloudinaryParams): string {
	return Object.entries(params)
		.filter(([key]) => !UNSIGNED_PARAMS.has(key))
		.map(([key, value]) => [key, renderParamValue(value)] as const)
		.filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, value]) => `${key}=${value}`.replace(/&/g, '%26'))
		.join('&');
}

export function signCloudinaryParams(params: CloudinaryParams, apiSecret: string): string {
	return createHash('sha1')
		.update(buildCloudinarySignatureString(params) + apiSecret)
		.digest('hex');
}

/** Multipart body for the Upload API: signed params plus the binary as a data URI. */
export function buildCloudinaryUploadForm(
	config: CloudinaryRestConfig,
	params: CloudinaryParams,
	file: string,
	timestamp = Math.floor(Date.now() / 1000),
): FormData {
	const signed: CloudinaryParams = { ...params, timestamp };
	const form = new FormData();
	for (const [key, value] of Object.entries(signed)) {
		const rendered = renderParamValue(value);
		if (rendered !== undefined && !UNSIGNED_PARAMS.has(key)) form.append(key, rendered);
	}
	form.append('signature', signCloudinaryParams(signed, config.apiSecret));
	form.append('api_key', config.apiKey);
	form.append('file', file);
	return form;
}

function basicAuthorization(config: CloudinaryRestConfig): string {
	return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`;
}

function apiBase(config: CloudinaryRestConfig): string {
	return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}`;
}

/** The SDK folds the feature rate-limit headers into every Admin API result; keep that. */
function withRateLimit(result: Record<string, unknown>, headers: Headers): Record<string, unknown> {
	const limit = headers.get('x-featureratelimit-limit');
	const remaining = headers.get('x-featureratelimit-remaining');
	const reset = headers.get('x-featureratelimit-reset');
	if (limit) result.rate_limit_allowed = Number.parseInt(limit, 10);
	if (remaining) result.rate_limit_remaining = Number.parseInt(remaining, 10);
	if (reset) result.rate_limit_reset_at = new Date(reset);
	return result;
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch {
		throw new CloudinaryApiError(response.status, 'Cloudinary API returned a malformed body.');
	}
	if (typeof parsed !== 'object' || parsed === null) {
		throw new CloudinaryApiError(response.status, 'Cloudinary API returned a malformed body.');
	}
	return parsed as Record<string, unknown>;
}

async function send(
	fetchImpl: typeof fetch,
	url: string,
	init: RequestInit,
): Promise<{ response: Response; body: Record<string, unknown> }> {
	let response: Response;
	try {
		response = await fetchImpl(url, {
			...init,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch {
		// Network and timeout failures carry no HTTP status; the message never echoes the request.
		throw new CloudinaryApiError(undefined);
	}
	if (!response.ok) {
		await response.body?.cancel?.();
		throw new CloudinaryApiError(response.status);
	}
	return { response, body: await readJsonBody(response) };
}

export interface CloudinaryRestClient {
	/** `GET /resources/image/upload/{public_id}` (Admin API, Basic auth). */
	getResource(
		publicId: string,
		options?: { context?: boolean },
	): Promise<Record<string, unknown>>;
	/** `POST /image/upload` (Upload API, signed parameters). */
	uploadImage(
		file: string,
		params: CloudinaryParams,
		options?: { timestamp?: number },
	): Promise<Record<string, unknown>>;
}

export function createCloudinaryRestClient(
	config: CloudinaryRestConfig,
	fetchImpl: typeof fetch = fetch,
): CloudinaryRestClient {
	return {
		async getResource(publicId, options = {}) {
			const url = new URL(
				`${apiBase(config)}/resources/image/upload/${publicId
					.split('/')
					.map(encodeURIComponent)
					.join('/')}`,
			);
			if (options.context) url.searchParams.set('context', 'true');
			const { response, body } = await send(fetchImpl, url.toString(), {
				method: 'GET',
				headers: { Authorization: basicAuthorization(config) },
			});
			return withRateLimit(body, response.headers);
		},
		async uploadImage(file, params, options = {}) {
			const form = buildCloudinaryUploadForm(config, params, file, options.timestamp);
			const { body } = await send(fetchImpl, `${apiBase(config)}/image/upload`, {
				method: 'POST',
				body: form,
			});
			return body;
		},
	};
}
