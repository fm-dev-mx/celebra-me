import {
	VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES,
	VALENTINA_MEMORIES_SIGN_PATH,
	getValentinaMemoriesMimePolicy,
	getValentinaMemoriesPresignExpiresAt,
	getValentinaMemoriesStorageBucketName,
	isWithinValentinaMemoriesUploadWindow,
} from '../../../src/data/valentina-memories-upload.contract';
import { isValentinaMemoriesObjectKeyForMime } from '../../../src/data/valentina-memories-media.contract';
import { MEMORIES_UPLOAD_REQUEST_AUDIENCE } from '../../../src/data/valentina-memories-private-request.contract';
import { verifyMemoriesPrivateRequest } from '../../shared/private-request';
import {
	getMemoriesRateLimiter,
	hasRequiredR2Secrets,
	type MemoriesSignEnv,
	type MemoriesSignHandlerOptions,
} from './env';
import { errorResponse, jsonResponse } from './http';
import { createPresignedR2PutUrl, sha256HexToBase64 } from './presign-r2-put';

const ALLOWED_SIGN_KEYS = new Set([
	'objectKey',
	'sessionId',
	'mimeType',
	'sizeBytes',
	'checksumSha256',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSignRequest(payload: unknown): {
	objectKey: string;
	sessionId: string;
	mimeType: string;
	sizeBytes: number;
	checksumSha256: string;
} | null {
	if (!isRecord(payload)) return null;
	const keys = Object.keys(payload);
	if (keys.length !== ALLOWED_SIGN_KEYS.size || keys.some((key) => !ALLOWED_SIGN_KEYS.has(key)))
		return null;
	const { objectKey, sessionId, mimeType, sizeBytes, checksumSha256 } = payload;
	if (
		typeof objectKey !== 'string' ||
		typeof sessionId !== 'string' ||
		!UUID_PATTERN.test(sessionId) ||
		typeof mimeType !== 'string' ||
		typeof sizeBytes !== 'number' ||
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		typeof checksumSha256 !== 'string' ||
		!/^[0-9a-f]{64}$/i.test(checksumSha256) ||
		!isValentinaMemoriesObjectKeyForMime(objectKey, mimeType)
	) {
		return null;
	}
	return {
		objectKey,
		sessionId,
		mimeType: mimeType.trim().toLowerCase(),
		sizeBytes,
		checksumSha256: checksumSha256.toLowerCase(),
	};
}

async function readBody(request: Request): Promise<string | null> {
	const declaredLength = Number(request.headers.get('Content-Length') || '0');
	if (declaredLength > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES) return null;
	const raw = await request.text();
	return raw && new TextEncoder().encode(raw).byteLength <= VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES
		? raw
		: null;
}

export async function handleMemoriesSignRequest(
	request: Request,
	env: MemoriesSignEnv,
	options: MemoriesSignHandlerOptions = {},
): Promise<Response> {
	const url = new URL(request.url);
	if (request.method !== 'POST' || url.pathname !== VALENTINA_MEMORIES_SIGN_PATH) {
		return errorResponse('not_found', 'La ruta solicitada no existe.', 404, null);
	}
	if (!hasRequiredR2Secrets(env)) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 503, null);
	}
	const bucketName = getValentinaMemoriesStorageBucketName(env.MEMORIES_STORAGE_TARGET);
	if (!bucketName) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 503, null);
	}
	const rawBody = await readBody(request);
	if (!rawBody) return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	if (
		!(await verifyMemoriesPrivateRequest({
			request,
			rawBody,
			expectedAudience: MEMORIES_UPLOAD_REQUEST_AUDIENCE,
			expectedPath: VALENTINA_MEMORIES_SIGN_PATH,
			publicKeyPem: env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
			now: options.now,
		}))
	) {
		return errorResponse('unauthorized', 'La solicitud no está autorizada.', 401, null);
	}
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody) as unknown;
	} catch {
		return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	}
	const input = parseSignRequest(payload);
	if (!input) return errorResponse('invalid_request', 'La solicitud no es válida.', 400, null);
	const now = options.now ?? new Date();
	if (!isWithinValentinaMemoriesUploadWindow(now)) {
		return errorResponse(
			'upload_window_closed',
			'La ventana de carga no está abierta.',
			403,
			null,
		);
	}
	const policy = getValentinaMemoriesMimePolicy(input.mimeType);
	if (!policy)
		return errorResponse('unsupported_mime', 'Tipo de archivo no permitido.', 400, null);
	if (input.sizeBytes > policy.maxBytes)
		return errorResponse('file_too_large', 'El archivo supera el tamaño permitido.', 400, null);
	const limiter = getMemoriesRateLimiter(env);
	if (!limiter || !(await limiter.limit({ key: input.sessionId })).success) {
		return errorResponse('rate_limited', 'Intente de nuevo en un momento.', 429, null);
	}
	try {
		const uploadUrl = await createPresignedR2PutUrl({
			accountId: env.MEMORIES_R2_ACCOUNT_ID,
			accessKeyId: env.MEMORIES_R2_PRESIGN_ACCESS_KEY_ID,
			secretAccessKey: env.MEMORIES_R2_PRESIGN_SECRET_ACCESS_KEY,
			bucket: bucketName,
			objectKey: input.objectKey,
			contentType: input.mimeType,
			checksumSha256Hex: input.checksumSha256,
			now,
		});
		return jsonResponse(
			{
				uploadUrl,
				requiredHeaders: {
					'Content-Type': input.mimeType,
					'If-None-Match': '*',
					'x-amz-checksum-sha256': sha256HexToBase64(input.checksumSha256),
				},
				expiresAt: getValentinaMemoriesPresignExpiresAt(now).toISOString(),
			},
			200,
			null,
		);
	} catch {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 500, null);
	}
}

export default {
	async fetch(request: Request, env: MemoriesSignEnv): Promise<Response> {
		return handleMemoriesSignRequest(request, env);
	},
};
