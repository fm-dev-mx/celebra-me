import {
	VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES,
	VALENTINA_MEMORIES_SIGN_PATH,
	buildValentinaMemoriesObjectKey,
	getValentinaMemoriesMimePolicy,
	getValentinaMemoriesPresignExpiresAt,
	isAllowedValentinaMemoriesOrigin,
	isWithinValentinaMemoriesUploadWindow,
} from '../../../src/data/valentina-memories-upload.contract';
import {
	getMemoriesRateLimiter,
	hasRequiredR2Secrets,
	type MemoriesSignEnv,
	type MemoriesSignHandlerOptions,
} from './env';
import { emptyResponse, errorResponse, jsonResponse } from './http';
import { createPresignedR2PutUrl } from './presign-r2-put';

const SIGN_REQUEST_KEYS = new Set(['mimeType', 'sizeBytes']);

function readClientIp(request: Request): string {
	return (
		request.headers.get('CF-Connecting-IP') ||
		request.headers.get('X-Forwarded-For') ||
		'missing-ip'
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSignRequest(payload: unknown): { mimeType: string; sizeBytes: number } | null {
	if (!isRecord(payload)) return null;

	const keys = Object.keys(payload);
	if (keys.length !== SIGN_REQUEST_KEYS.size || keys.some((key) => !SIGN_REQUEST_KEYS.has(key))) {
		return null;
	}

	const { mimeType, sizeBytes } = payload;
	if (typeof mimeType !== 'string' || mimeType.trim() === '') return null;
	if (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes <= 0)
		return null;

	return { mimeType, sizeBytes };
}

async function readJsonBody(request: Request): Promise<unknown | 'too_large' | 'invalid'> {
	const declaredLength = Number(request.headers.get('Content-Length') || '0');
	if (declaredLength > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES) return 'too_large';

	const raw = await request.text();
	if (new TextEncoder().encode(raw).byteLength > VALENTINA_MEMORIES_JSON_BODY_MAX_BYTES) {
		return 'too_large';
	}

	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return 'invalid';
	}
}

async function handleSignPost(
	request: Request,
	env: MemoriesSignEnv,
	origin: string | null,
	options: MemoriesSignHandlerOptions,
): Promise<Response> {
	if (!isAllowedValentinaMemoriesOrigin(origin)) {
		return errorResponse(
			'invalid_origin',
			'El origen de esta solicitud no está autorizado.',
			403,
			origin,
		);
	}

	const now = options.now ?? new Date();
	if (!isWithinValentinaMemoriesUploadWindow(now)) {
		return errorResponse(
			'upload_window_closed',
			'La ventana para subir recuerdos no está abierta.',
			403,
			origin,
		);
	}

	const rateLimiter = getMemoriesRateLimiter(env);
	if (!rateLimiter) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 500, origin);
	}

	const rate = await rateLimiter.limit({ key: readClientIp(request) });
	if (!rate.success) {
		return errorResponse(
			'rate_limited',
			'Hay demasiadas solicitudes. Intente de nuevo en un momento.',
			429,
			origin,
		);
	}

	const parsedBody = await readJsonBody(request);
	if (parsedBody === 'too_large' || parsedBody === 'invalid') {
		return errorResponse(
			'invalid_request',
			'El cuerpo de la solicitud no es válido.',
			400,
			origin,
		);
	}

	const signRequest = parseSignRequest(parsedBody);
	if (!signRequest) {
		return errorResponse(
			'invalid_request',
			'El cuerpo de la solicitud no es válido.',
			400,
			origin,
		);
	}

	const mimePolicy = getValentinaMemoriesMimePolicy(signRequest.mimeType);
	if (!mimePolicy) {
		return errorResponse(
			'unsupported_mime',
			'Este tipo de archivo no está permitido.',
			400,
			origin,
		);
	}

	if (signRequest.sizeBytes > mimePolicy.maxBytes) {
		return errorResponse(
			'file_too_large',
			'El archivo supera el tamaño permitido.',
			400,
			origin,
		);
	}

	if (!hasRequiredR2Secrets(env)) {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 500, origin);
	}

	const objectId = (options.randomUUID ?? crypto.randomUUID.bind(crypto))();
	const objectKey = buildValentinaMemoriesObjectKey(objectId, mimePolicy.extension);
	const mimeType = signRequest.mimeType.trim().toLowerCase();
	const expiresAt = getValentinaMemoriesPresignExpiresAt(now);

	try {
		const uploadUrl = await createPresignedR2PutUrl({
			accountId: env.R2_ACCOUNT_ID,
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			bucket: env.R2_BUCKET,
			objectKey,
			contentType: mimeType,
			now,
		});

		return jsonResponse(
			{ uploadUrl, objectKey, expiresAt: expiresAt.toISOString() },
			200,
			origin,
		);
	} catch {
		return errorResponse('sign_failed', 'No se pudo firmar la subida.', 500, origin);
	}
}

export async function handleMemoriesSignRequest(
	request: Request,
	env: MemoriesSignEnv,
	options: MemoriesSignHandlerOptions = {},
): Promise<Response> {
	const origin = request.headers.get('Origin');
	const url = new URL(request.url);
	const method = request.method.toUpperCase();

	if (url.pathname !== VALENTINA_MEMORIES_SIGN_PATH) {
		return errorResponse('not_found', 'La ruta solicitada no existe.', 404, origin);
	}

	if (method === 'OPTIONS') {
		if (!isAllowedValentinaMemoriesOrigin(origin)) {
			return errorResponse(
				'invalid_origin',
				'El origen de esta solicitud no está autorizado.',
				403,
				origin,
			);
		}
		return emptyResponse(204, origin);
	}

	if (method !== 'POST') {
		return errorResponse('method_not_allowed', 'Este método no está permitido.', 405, origin, {
			Allow: 'OPTIONS, POST',
		});
	}

	return handleSignPost(request, env, origin, options);
}

export default {
	async fetch(request: Request, env: MemoriesSignEnv): Promise<Response> {
		return handleMemoriesSignRequest(request, env);
	},
};
