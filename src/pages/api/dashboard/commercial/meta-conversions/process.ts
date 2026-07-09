import type { APIRoute } from 'astro';
import { processPendingMetaConversionEvents, deliverMetaConversionEvent } from '@/lib/commercial/meta-capi/service';
import { requireAdminMutationAccess, requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

interface RequeueRequestBody {
	action?: string;
	eventId?: string;
}

interface ConversionEventRow {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
	attempt_count: number;
	last_error_message: string | null;
	created_at: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		let body: RequeueRequestBody | null = null;
		try {
			const req = typeof request.clone === 'function' ? request.clone() : request;
			body = await req.json() as RequeueRequestBody;
		} catch {
			// No body or parsing failed
		}

		const isRequeue = body?.action === 'requeue' && body?.eventId;

		await requireAdminMutationAccess(
			request,
			cookies,
			isRequeue
				? 'commercial:meta-conversions:requeue'
				: 'commercial:meta-conversions:process',
		);

		if (isRequeue) {
			const eventId = body!.eventId!;
			await supabaseRestRequest<unknown>({
				pathWithQuery: `meta_conversion_events?id=eq.${encodeURIComponent(eventId)}`,
				method: 'PATCH',
				useServiceRole: true,
				prefer: 'return=minimal',
				body: {
					status: 'pending',
					attempt_count: 0,
					last_error_code: null,
					last_error_message: null,
					next_attempt_at: null,
					updated_at: new Date().toISOString(),
				},
			});

			const status = await deliverMetaConversionEvent(eventId);
			return successResponse({ eventId, status });
		}

		const result = await processPendingMetaConversionEvents();

		return successResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminStrongSession(request);

		const rows = await supabaseRestRequest<ConversionEventRow[]>({
			pathWithQuery: `meta_conversion_events?select=id,event_name,event_id,value,currency,status,attempt_count,last_error_message,created_at&order=created_at.desc&limit=50`,
			method: 'GET',
			useServiceRole: true,
		});

		// Map to camelCase DTOs for consistency with other commercial APIs.
		const data = rows.map((r) => ({
			id: r.id,
			event_name: r.event_name,
			event_id: r.event_id,
			eventName: r.event_name,
			eventId: r.event_id,
			value: r.value,
			currency: r.currency,
			status: r.status,
			attempt_count: r.attempt_count,
			attemptCount: r.attempt_count,
			last_error_message: r.last_error_message,
			lastErrorMessage: r.last_error_message,
			created_at: r.created_at,
			createdAt: r.created_at,
		}));

		return successResponse(data);
	} catch (error) {
		return errorResponse(error);
	}
};
