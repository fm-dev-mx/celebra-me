/**
 * Engagement maintenance as an invocable job: runs the maintenance and logs the outcome with
 * its `source`. The Worker `scheduled()` handler runs it.
 */
import {
	runEngagementMaintenance,
	type EngagementMaintenanceResult,
} from './engagement-maintenance.service';
import { safeErr } from '@/lib/server/safe-error';

const ENGAGEMENT_MAINTENANCE_SCHEDULED_SOURCE = 'scheduled_cron';

export interface EngagementMaintenanceJobDeps {
	/** Who triggered the run, e.g. `scheduled_cron`; logged with the counts. */
	source?: string;
	maintenance?: () => Promise<EngagementMaintenanceResult>;
	log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export type EngagementMaintenanceJobOutcome =
	| { kind: 'completed'; result: EngagementMaintenanceResult }
	| { kind: 'exception'; message: string };

export async function runEngagementMaintenanceJob(
	deps: EngagementMaintenanceJobDeps = {},
): Promise<EngagementMaintenanceJobOutcome> {
	const source = deps.source ?? ENGAGEMENT_MAINTENANCE_SCHEDULED_SOURCE;
	const maintenance = deps.maintenance ?? runEngagementMaintenance;
	const log = deps.log ?? console;
	try {
		const result = await maintenance();
		const write = result.snapshotsFailed > 0 ? log.warn : log.info;
		write.call(log, '[engagement][maintenance] completed', { source, ...result });
		return { kind: 'completed', result };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log.error('[engagement][maintenance] failed', { source, error: safeErr(error) });
		return { kind: 'exception', message };
	}
}
