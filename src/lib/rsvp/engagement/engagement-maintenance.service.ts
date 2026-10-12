import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	anonymizeGuestEngagementEventsRpc,
	computeInvitationEngagementSnapshotRpc,
	listEngagementSnapshotCandidatesRpc,
} from '@/lib/rsvp/repositories/engagement.repository';
import { DESIGN_SCHEMA_VERSION, extractDesignAttributes } from './design-attributes';

const ANONYMIZE_BATCH = 1000;
const MAX_ANONYMIZE_BATCHES = 20;

export interface EngagementMaintenanceResult {
	snapshotsWritten: number;
	snapshotsUnchanged: number;
	snapshotsFailed: number;
	anonymizedEvents: number;
	anonymizationComplete: boolean;
}

async function designFor(invitationId: string | null) {
	if (!invitationId) return null;
	try {
		const published = await findPublishedByInvitationId(invitationId);
		return published ? extractDesignAttributes(published.content) : null;
	} catch {
		// A snapshot without design attributes is still worth keeping.
		return null;
	}
}

/**
 * Daily guest engagement maintenance, in this order: refresh rolling snapshots, freeze final
 * snapshots, then anonymize ledger rows past retention. The database refuses to anonymize an
 * invitation whose snapshot is stale, so a failed snapshot only delays anonymization.
 */
export async function runEngagementMaintenance(): Promise<EngagementMaintenanceResult> {
	const result: EngagementMaintenanceResult = {
		snapshotsWritten: 0,
		snapshotsUnchanged: 0,
		snapshotsFailed: 0,
		anonymizedEvents: 0,
		anonymizationComplete: false,
	};

	const candidates = await listEngagementSnapshotCandidatesRpc();
	for (const candidate of candidates) {
		try {
			const design = await designFor(candidate.invitation_project_id);
			const outcome = await computeInvitationEngagementSnapshotRpc(
				candidate.event_id,
				candidate.snapshot_kind,
				design ? { ...design } : null,
				design ? DESIGN_SCHEMA_VERSION : null,
			);
			if (outcome.status === 'ok') result.snapshotsWritten += 1;
			else result.snapshotsUnchanged += 1;
		} catch {
			result.snapshotsFailed += 1;
		}
	}

	for (let batch = 0; batch < MAX_ANONYMIZE_BATCHES; batch += 1) {
		const count = await anonymizeGuestEngagementEventsRpc(ANONYMIZE_BATCH);
		result.anonymizedEvents += count;
		if (count < ANONYMIZE_BATCH) {
			result.anonymizationComplete = true;
			break;
		}
	}
	return result;
}
