/**
 * Sign Worker: issues single-use upload capabilities for reservations the app
 * signed, and receives the PUT bytes into the private R2 binding.
 *
 * Event-neutral by design: window, quotas and ownership are decided by the app
 * and its database before the request is signed. This Worker only verifies the
 * envelope, the global media policy and the capability it issued.
 */

import { MEMORIES_JSON_BODY_MAX_BYTES } from '../../../src/lib/memories/contract/limits';
import {
	MEMORIES_UUID_PATTERN,
	isValidSha256Hex,
} from '../../../src/lib/memories/contract/catalog';
import {
	getMemoriesMimePolicy,
	type MemoriesMimePolicy,
} from '../../../src/lib/memories/contract/media-policy';
import { isMemoriesObjectKeyForMime } from '../../../src/lib/memories/contract/object-key';
import {
	MEMORIES_PRIVATE_REQUEST_TTL_SECONDS,
	MEMORIES_SIGN_PATH,
	MEMORIES_UPLOAD_PATH,
	MEMORIES_UPLOAD_REQUEST_AUDIENCE,
} from '../../../src/lib/memories/contract/private-request';
import { readBoundedText } from '../../shared/bounded-body';
import { sha256HexToArrayBuffer, sha256HexToBase64 } from '../../shared/encoding';
import { privateRequestId, verifyMemoriesPrivateRequest } from '../../shared/private-request';
import { consumeReplayKey } from '../../shared/replay-guard';
import { createUploadCapability, verifyUploadCapability } from './capability';
import {
	allowedBrowserOrigins,
	getMemoriesRateLimiter,
	isSignEnvConfigured,
	type MemoriesSignEnv,
	type MemoriesSignHandlerOptions,
} from './env';
import { MEMORY_UPLOAD_CORS_HEADERS, errorResponse, jsonResponse } from './http';

const ALLOWED_SIGN_KEYS = new Set([
	'objectKey',
	'sessionId',
	'mimeType',
	'sizeBytes',
	'checksumSha256',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A key that matches its MIME implies an allow-listed policy; the policy travels with the input. */
function parseSignRequest(payload: unknown): {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
	policy: MemoriesMimePolicy;
} | null {
	if (!isRecord(payload)) return null;
	const keys = Object.keys(payload);
	if (keys.length !== ALLOWED_SIGN_KEYS.size || keys.some((key) => !ALLOWED_SIGN_KEYS.has(key)))
		return null;
	const { objectKey, sessionId, mimeType, sizeBytes, checksumSha256 } = payload;
	if (
		typeof objectKey !== 'string' ||
		typeof sessionId !== 'string' ||
		!MEMORIES_UUID_PATTERN.test(sessionId) ||
		typeof mimeType !== 'string' ||
		typeof sizeBytes !== 'number' ||
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		!isValidSha256Hex(checksumSha256) ||
		!isMemoriesObjectKeyForMime(objectKey, mimeType)
	) {
		return null;
	}
	const policy = getMemoriesMimePolicy(mimeType);
	if (!policy) return null;
	return {
		objectKey,
		sessionId,
		mimeType: mimeType.trim().toLowerCase(),
		sizeBytes,
		checksumSha256: checksumSha256.toLowerCase(),
		policy,
	};
}

function allowedOrigin(request: Request, env: MemoriesSignEnv): string | null {
	const origin = request.headers.get('Origin');
	return origin && allowedBrowserOrigins(env).has(origin) ? origin : null;
}

export async function handleMemoriesUploadRequest(
	request: Request,
	env: MemoriesSignEnv,
	now = new Date(),
): Promise<Response> {
	const origin = allowedOrigin(request, env);
	if (!origin) return errorResponse('unauthorized', 403, null);
	if (request.method === 'OPTIONS')
		return new Response(null, {
			status: 204,
			headers: { ...MEMORY_UPLOAD_CORS_HEADERS, 'Access-Control-Allow-Origin': origin },
		});
	if (request.method !== 'PUT') return errorResponse('not_found', 404, origin);
	if (!isSignEnvConfigured(env)) return errorResponse('unavailable', 503, origin);
	const authorization = request.headers.get('Authorization') ?? '';
	const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
	const claims = await verifyUploadCapability(token, env.MEMORIES_UPLOAD_CAPABILITY_SECRET, now);
	const checksum = request.headers.get('x-amz-checksum-sha256') ?? '';
	const contentLength = request.headers.get('Content-Length');
	if (
		!claims ||
		!isMemoriesObjectKeyForMime(claims.objectKey, claims.mimeType) ||
		!getMemoriesMimePolicy(claims.mimeType) ||
		request.headers.get('Content-Type') !== claims.mimeType ||
		checksum !== sha256HexToBase64(claims.checksumSha256) ||
		contentLength !== String(claims.sizeBytes) ||
		!request.body
	) {
		return errorResponse('capability_invalid', 400, origin);
	}
	const claimed = await consumeReplayKey(
		env.NONCE_GUARD,
		`upload:${claims.nonce}`,
		claims.expiresAt * 1000,
	);
	if (!claimed) return errorResponse('replay', 409, origin);

	const fixedLength = new FixedLengthStream(claims.sizeBytes);
	const uploadPromise = env.MEMORIES_BUCKET.put(claims.objectKey, fixedLength.readable, {
		httpMetadata: { contentType: claims.mimeType },
		sha256: sha256HexToArrayBuffer(claims.checksumSha256),
		onlyIf: { etagDoesNotMatch: '*' },
	});
	const copyPromise = request.body.pipeTo(fixedLength.writable);
	const results = await Promise.allSettled([uploadPromise, copyPromise]);
	const uploadResult = results[0].status === 'fulfilled' ? results[0].value : null;
	if (results.some((result) => result.status === 'rejected') || !uploadResult) {
		return errorResponse('upload_failed', 400, origin);
	}
	return jsonResponse({ uploaded: true }, 201, origin);
}

export async function handleMemoriesSignRequest(
	request: Request,
	env: MemoriesSignEnv,
	options: MemoriesSignHandlerOptions = {},
): Promise<Response> {
	const url = new URL(request.url);
	if (request.method !== 'POST' || url.pathname !== MEMORIES_SIGN_PATH) {
		return errorResponse('not_found', 404, null);
	}
	if (!isSignEnvConfigured(env)) return errorResponse('unavailable', 503, null);
	const rawBody = await readBoundedText(request, MEMORIES_JSON_BODY_MAX_BYTES);
	if (rawBody === null) return errorResponse('invalid_request', 400, null);
	if (
		!(await verifyMemoriesPrivateRequest({
			request,
			rawBody,
			expectedAudience: MEMORIES_UPLOAD_REQUEST_AUDIENCE,
			expectedPath: MEMORIES_SIGN_PATH,
			publicKeyPem: env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
			now: options.now,
		}))
	) {
		return errorResponse('unauthorized', 401, null);
	}
	const now = options.now ?? new Date();
	const claimed = await consumeReplayKey(
		env.NONCE_GUARD,
		`private:${privateRequestId(request)}`,
		now.getTime() + MEMORIES_PRIVATE_REQUEST_TTL_SECONDS * 1000,
	);
	if (!claimed) return errorResponse('replay', 409, null);
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody) as unknown;
	} catch {
		return errorResponse('invalid_request', 400, null);
	}
	const input = parseSignRequest(payload);
	if (!input) return errorResponse('invalid_request', 400, null);
	if (input.sizeBytes > input.policy.maxBytes) return errorResponse('file_too_large', 400, null);
	const limiter = getMemoriesRateLimiter(env);
	if (!limiter || !(await limiter.limit({ key: input.sessionId })).success) {
		return errorResponse('rate_limited', 429, null);
	}
	try {
		// Only the named claims are sealed; the policy stays local to this request.
		const capability = await createUploadCapability(
			input,
			env.MEMORIES_UPLOAD_CAPABILITY_SECRET,
			now,
		);
		return jsonResponse(
			{
				uploadUrl: new URL(MEMORIES_UPLOAD_PATH, request.url).toString(),
				requiredHeaders: {
					Authorization: `Bearer ${capability.token}`,
					'Content-Type': input.mimeType,
					'x-amz-checksum-sha256': sha256HexToBase64(input.checksumSha256),
				},
				expiresAt: capability.expiresAt,
			},
			200,
			null,
		);
	} catch {
		return errorResponse('sign_failed', 500, null);
	}
}

export default {
	async fetch(request: Request, env: MemoriesSignEnv): Promise<Response> {
		if (new URL(request.url).pathname === MEMORIES_UPLOAD_PATH)
			return handleMemoriesUploadRequest(request, env);
		return handleMemoriesSignRequest(request, env);
	},
};

export { ReplayGuard } from '../../shared/replay-guard';
