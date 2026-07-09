import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { TrackingEventName } from '@/lib/tracking/event-contract';

/**
 * Fire-and-forget utility to record an internal commercial tracking event
 * for order_created and deposit_paid. Errors are logged but not propagated
 * so they never block the primary business flow.
 */
export async function emitCommercialTrackingEvent(input: {
	eventName: TrackingEventName;
	customerId: string;
	orderId: string;
	sessionId?: string | null;
	totalAmount: number;
	amountPaid?: number;
}): Promise<void> {
	try {
		const sessionId = input.sessionId || '00000000-0000-4000-8000-000000000001';
		const visitorId = `internal:commercial:${input.customerId}`;

		await supabaseRestRequest<unknown>({
			pathWithQuery: 'tracking_events?select=id',
			method: 'POST',
			useServiceRole: true,
			prefer: 'return=minimal',
			body: {
				session_id: sessionId,
				visitor_id: visitorId,
				event_name: input.eventName,
				route_path: '/api/dashboard/commercial',
				route_class: 'commercial',
				is_internal: true,
				occurred_at: new Date().toISOString(),
				event_properties: {
					customer_id: input.customerId,
					order_id: input.orderId,
					total_amount: input.totalAmount,
					amount_paid: input.amountPaid ?? 0,
				},
				consent_snapshot: { necessary: true, analytics: true, marketing: true },
			},
		});
	} catch (error) {
		console.error(`[commercial-tracking] Failed to emit ${input.eventName} event:`, error);
	}
}
