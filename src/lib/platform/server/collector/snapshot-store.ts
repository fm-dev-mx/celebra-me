/**
 * Service-role access to `platform_usage_snapshots`. RLS denies anon and
 * authenticated; only the Production collector writes and purges.
 */

import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { PlatformSnapshotRow } from './types';

const TABLE = 'platform_usage_snapshots';

export async function insertPlatformSnapshots(rows: PlatformSnapshotRow[]): Promise<void> {
	if (rows.length === 0) return;
	await supabaseRestRequest<unknown>({
		pathWithQuery: TABLE,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: rows,
	});
}

/** Deletes every snapshot collected before `cutoff`. */
export async function purgePlatformSnapshots(cutoff: Date): Promise<void> {
	await supabaseRestRequest<unknown>({
		pathWithQuery: `${TABLE}?collected_at=lt.${encodeURIComponent(cutoff.toISOString())}`,
		method: 'DELETE',
		useServiceRole: true,
		prefer: 'return=minimal',
	});
}
