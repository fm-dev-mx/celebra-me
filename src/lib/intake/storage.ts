import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/server/supabase-credentials';
import { ApiError } from '@/lib/rsvp/core/errors';

const DEFAULT_BUCKET = 'invitation-assets';
const STORAGE_CONFIG_MESSAGE = 'La carga de imágenes no está disponible en este momento.';
const STORAGE_UNAUTHORIZED_MESSAGE = 'No se pudo autorizar la carga de la imagen.';
const STORAGE_BUCKET_MISSING_MESSAGE = 'La biblioteca de imágenes no está configurada.';
const STORAGE_GENERIC_MESSAGE = 'No se pudo subir la imagen. Intenta nuevamente.';

export function getPublicUrl(bucket: string, path: string): string {
	return `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${path}`;
}

function resolveStorageConfig(): { supabaseUrl: string; serviceRoleKey: string; keyShape: string } {
	try {
		const supabaseUrl = getSupabaseUrl();
		const serviceRoleKey = getSupabaseServiceRoleKey();
		return { supabaseUrl, serviceRoleKey, keyShape: classifyKeyShape(serviceRoleKey) };
	} catch (error) {
		console.error('[storage] Supabase Storage configuration error:', {
			message: error instanceof Error ? error.message : String(error),
		});
		throw new ApiError(500, 'config_error', STORAGE_CONFIG_MESSAGE);
	}
}

function classifyKeyShape(key: string): string {
	const segments = key.split('.').length;

	if (key.startsWith('eyJ') && segments === 3) {
		return 'legacy-jwt';
	}

	if (key.startsWith('sb_secret_')) {
		return 'supabase-secret';
	}

	if (key.startsWith('sb_')) {
		return 'supabase-modern-or-local';
	}

	return `unknown:${segments}`;
}

function sanitizeStorageError(status: number, body: string, statusText: string): ApiError {
	const normalized = `${body} ${statusText}`.toLowerCase();
	if (
		status === 401 ||
		status === 403 ||
		normalized.includes('unauthorized') ||
		normalized.includes('invalid compact jws')
	) {
		return new ApiError(502, 'config_error', STORAGE_UNAUTHORIZED_MESSAGE);
	}
	if (status === 404 || normalized.includes('bucket not found')) {
		return new ApiError(502, 'config_error', STORAGE_BUCKET_MISSING_MESSAGE);
	}
	return new ApiError(502, 'internal_error', STORAGE_GENERIC_MESSAGE);
}

export async function uploadToStorage(
	bucket: string,
	path: string,
	file: Blob,
	contentType: string,
): Promise<string> {
	const { supabaseUrl, serviceRoleKey, keyShape } = resolveStorageConfig();
	const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			apikey: serviceRoleKey,
			Authorization: `Bearer ${serviceRoleKey}`,
			'Content-Type': contentType,
		},
		body: file,
	});

	if (!response.ok) {
		const text = await response.text();
		const redactedBody = (text || response.statusText).split(serviceRoleKey).join('<redacted>');
		console.error('[storage] Storage upload failed:', {
			status: response.status,
			statusText: response.statusText,
			bucket,
			path,
			keyShape,
			body: redactedBody,
		});
		throw sanitizeStorageError(response.status, text, response.statusText);
	}

	return getPublicUrl(bucket, path);
}

export { DEFAULT_BUCKET };
