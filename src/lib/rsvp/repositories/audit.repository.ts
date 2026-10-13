import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export async function createAuditLog(input: {
	actorId: string | null;
	action: string;
	targetTable: string;
	targetId: string;
	oldData?: Record<string, unknown> | null;
	newData?: Record<string, unknown> | null;
	useServiceRole?: boolean;
}): Promise<void> {
	await supabaseRestRequest<unknown[]>({
		pathWithQuery: 'audit_logs',
		method: 'POST',
		useServiceRole: input.useServiceRole ?? true,
		prefer: 'return=minimal',
		body: {
			actor_id: input.actorId,
			action: input.action,
			target_table: input.targetTable,
			target_id: input.targetId,
			old_data: input.oldData,
			new_data: input.newData,
		},
	});
}
