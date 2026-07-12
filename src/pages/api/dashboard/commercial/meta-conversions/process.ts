import type { APIRoute } from 'astro';
import { processPendingMetaConversionEvents } from '@/lib/commercial/meta-capi/service';
import {
	requireAdminMutationAccess,
	requireAdminStrongSession,
} from '@/lib/rsvp/auth/authorization';
import { errorResponse, successResponse } from '@/lib/rsvp/core/http';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { ApiError } from '@/lib/rsvp/core/errors';
import { loadCommercialDashboardOutbox } from '@/lib/tracking/commercial-dashboard.server';

interface RequeueRequestBody {
	action?: string;
	eventId?: string;
	reason?: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		let body: RequeueRequestBody | null = null;
		try {
			const req = typeof request.clone === 'function' ? request.clone() : request;
			body = (await req.json()) as RequeueRequestBody;
		} catch {
			// No body or parsing failed
		}

		const isRequeue = body?.action === 'requeue' && body?.eventId;

		const session = await requireAdminMutationAccess(
			request,
			cookies,
			isRequeue
				? 'commercial:meta-conversions:requeue'
				: 'commercial:meta-conversions:process',
		);

		if (isRequeue) {
			const eventId = body!.eventId!;
			const reason = body?.reason?.trim();
			if (!reason || reason.length < 3 || reason.length > 500) {
				throw new ApiError(
					400,
					'validation_error',
					'La razón de recuperación es obligatoria.',
				);
			}
			let rows: Array<{ id: string; status: string }>;
			try {
				rows = await supabaseRestRequest<Array<{ id: string; status: string }>>({
					pathWithQuery: 'rpc/recover_meta_conversion_event',
					method: 'POST',
					useServiceRole: true,
					body: {
						p_event_id: eventId,
						p_actor_id: session.userId,
						p_reason: reason,
						p_now: new Date().toISOString(),
					},
				});
			} catch (recoveryError) {
				const message =
					recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
				if (message.includes('no se puede recuperar')) {
					throw new ApiError(
						409,
						'conflict',
						'El estado actual del evento no permite recuperación.',
					);
				}
				throw recoveryError;
			}
			return successResponse({ eventId, status: rows[0]?.status ?? 'pending' });
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

		const rows = await loadCommercialDashboardOutbox();

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
			next_attempt_at: r.next_attempt_at,
			claimed_at: r.claimed_at,
			claim_expires_at: r.claim_expires_at,
			sent_at: r.sent_at,
			last_error_code: r.last_error_code,
			provider_events_received: r.provider_events_received,
			provider_trace_id: r.provider_trace_id,
			attempt_history: r.attempt_history,
			recovery_history: r.recovery_history,
		}));

		return successResponse(data);
	} catch (error) {
		return errorResponse(error);
	}
};
