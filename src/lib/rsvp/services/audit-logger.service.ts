import { createAuditLog } from '@/lib/rsvp/repositories/audit.repository';
import { sanitize } from '@/lib/rsvp/core/utils';

export async function logAdminAction(input: {
	actorId: string;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
}) {
	if (!sanitize(input.actorId, 120)) return;
	try {
		await createAuditLog({
			...input,
			useServiceRole: true,
		});
	} catch (error) {
		console.error('[Audit] Failed to log admin action:', error);
	}
}

/** Critical external mutations require audit failure to remain observable to their orchestrator. */
export async function logAdminActionStrict(input: {
	actorId: string;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
}): Promise<void> {
	if (!sanitize(input.actorId, 120)) throw new Error('Audit actor is required.');
	await createAuditLog({ ...input, useServiceRole: true });
}
