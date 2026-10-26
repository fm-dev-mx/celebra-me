import type { APIRoute } from 'astro';
import {
	deleteInvitationDataPhoto,
	uploadInvitationDataPhoto,
} from '@/lib/invitation-data/service';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	errorResponse,
	getIp,
	parseJsonBody,
	readBoundedRequestBytes,
	successResponse,
} from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';

export const prerender = false;

const MAX_MULTIPART_BODY_BYTES = 10 * 1024 * 1024 + 64 * 1024;
const MAX_JSON_BODY_BYTES = 8 * 1024;

/**
 * «Datos de su invitación»: uploads and deletes photos for the private form behind
 * `/mi-invitacion/<token>`. The token travels in the form data / body so it stays out of request logs.
 */
export const POST: APIRoute = async ({ request }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'invitation-data-photos',
			ip: getIp(request),
			maxHits: 60,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(
				new ApiError(
					429,
					'rate_limited',
					'Recibimos muchas solicitudes. Intente de nuevo en un minuto.',
				),
			);
		}

		const rawBody = await readBoundedRequestBytes(request, MAX_MULTIPART_BODY_BYTES);
		const forwardedHeaders: Record<string, string> = {};
		request.headers.forEach((value, name) => {
			forwardedHeaders[name] = value;
		});
		const boundedBody = rawBody.buffer.slice(
			rawBody.byteOffset,
			rawBody.byteOffset + rawBody.byteLength,
		) as ArrayBuffer;
		const boundedRequest = new Request(request.url, {
			method: request.method,
			headers: forwardedHeaders,
			body: boundedBody,
		});

		const formData = await boundedRequest.formData();
		const token = formData.get('token');
		const file = formData.get('file');

		if (!token || typeof token !== 'string') {
			throw new ApiError(400, 'bad_request', 'Falta el enlace de la invitación.');
		}
		if (!file || typeof file === 'string') {
			throw new ApiError(400, 'bad_request', 'No se envió ningún archivo.');
		}

		const blob = file as Blob;
		const fileName =
			(formData.get('fileName') as string) ||
			(typeof (file as File).name === 'string' ? (file as File).name : 'foto');
		const mimeType = blob.type;

		const result = await uploadInvitationDataPhoto({
			token,
			file: blob,
			fileName,
			mimeType,
		});

		return successResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		const allowed = await checkRateLimit({
			namespace: 'tracking',
			entityId: 'invitation-data-photos',
			ip: getIp(request),
			maxHits: 60,
			windowSec: 60,
		});
		if (!allowed) {
			return errorResponse(
				new ApiError(
					429,
					'rate_limited',
					'Recibimos muchas solicitudes. Intente de nuevo en un minuto.',
				),
			);
		}

		const payload = await parseJsonBody(request, MAX_JSON_BODY_BYTES);
		if (payload instanceof Response) return payload;

		const { token, photoId } = (payload ?? {}) as { token?: unknown; photoId?: unknown };
		if (!token || typeof token !== 'string' || !photoId || typeof photoId !== 'string') {
			throw new ApiError(400, 'bad_request', 'Solicitud no válida.');
		}

		const result = await deleteInvitationDataPhoto({ token, photoId });
		return successResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
