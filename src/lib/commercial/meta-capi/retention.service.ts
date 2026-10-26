import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

/**
 * Meta conversion retention, run by the quarter-hour sweep. The rules live in the database
 * (public.purge_meta_conversion_retention): delivered or skipped browser rows
 * go after 30 days, consent withdrawals once they are older than every stored visitor session.
 * This service only drives small batches.
 */
export const META_RETENTION_BATCH = 500;
export const MAX_META_RETENTION_BATCHES = 4;

export interface MetaRetentionResult {
	conversionEventsDeleted: number;
	consentWithdrawalsDeleted: number;
	batches: number;
	complete: boolean;
}

interface PurgeBatchRow {
	meta_conversion_events: number;
	visitor_consent_withdrawals: number;
}

async function purgeMetaRetentionRpc(batchSize: number): Promise<PurgeBatchRow> {
	return await supabaseRestRequest<PurgeBatchRow>({
		pathWithQuery: 'rpc/purge_meta_conversion_retention',
		method: 'POST',
		useServiceRole: true,
		body: { p_batch: batchSize },
	});
}

/** Purges both tables until a batch comes back short or the per-run cap is reached. */
export async function runMetaConversionRetention(): Promise<MetaRetentionResult> {
	const result: MetaRetentionResult = {
		conversionEventsDeleted: 0,
		consentWithdrawalsDeleted: 0,
		batches: 0,
		complete: false,
	};
	for (let batch = 0; batch < MAX_META_RETENTION_BATCHES; batch += 1) {
		const deleted = await purgeMetaRetentionRpc(META_RETENTION_BATCH);
		result.batches += 1;
		result.conversionEventsDeleted += deleted.meta_conversion_events;
		result.consentWithdrawalsDeleted += deleted.visitor_consent_withdrawals;
		if (
			deleted.meta_conversion_events < META_RETENTION_BATCH &&
			deleted.visitor_consent_withdrawals < META_RETENTION_BATCH
		) {
			result.complete = true;
			break;
		}
	}
	return result;
}
