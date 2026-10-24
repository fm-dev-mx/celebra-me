import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

/**
 * Daily commercial analytics retention. The 13-month rule lives in the database
 * (public.commercial_analytics_retention_cutoff); this service only drives the batches.
 */
export const COMMERCIAL_PURGE_BATCH = 5000;
export const MAX_COMMERCIAL_PURGE_BATCHES = 20;

export interface CommercialRetentionResult {
	trackingEventsDeleted: number;
	visitorSessionsDeleted: number;
	batches: number;
	complete: boolean;
}

interface PurgeBatchRow {
	tracking_events: number;
	visitor_sessions: number;
}

async function purgeCommercialAnalyticsRpc(batchSize: number): Promise<PurgeBatchRow> {
	return await supabaseRestRequest<PurgeBatchRow>({
		pathWithQuery: 'rpc/purge_commercial_analytics',
		method: 'POST',
		useServiceRole: true,
		body: { p_batch: batchSize },
	});
}

/** Purges tracking_events and orphan visitor_sessions past retention until a batch comes back short. */
export async function runCommercialRetention(): Promise<CommercialRetentionResult> {
	const result: CommercialRetentionResult = {
		trackingEventsDeleted: 0,
		visitorSessionsDeleted: 0,
		batches: 0,
		complete: false,
	};
	for (let batch = 0; batch < MAX_COMMERCIAL_PURGE_BATCHES; batch += 1) {
		const deleted = await purgeCommercialAnalyticsRpc(COMMERCIAL_PURGE_BATCH);
		result.batches += 1;
		result.trackingEventsDeleted += deleted.tracking_events;
		result.visitorSessionsDeleted += deleted.visitor_sessions;
		if (
			deleted.tracking_events < COMMERCIAL_PURGE_BATCH &&
			deleted.visitor_sessions < COMMERCIAL_PURGE_BATCH
		) {
			result.complete = true;
			break;
		}
	}
	return result;
}
