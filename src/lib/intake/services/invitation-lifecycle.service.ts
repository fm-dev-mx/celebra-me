import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { recordInvitationMutationOutcome } from '@/lib/intake/services/mutation-operation.service';
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export type InvitationLifecycleAction = 'archive' | 'restore' | 'permanent_delete';

const ACTIONS: Record<
	InvitationLifecycleAction,
	{ rpc: string; success: unknown; notFound: string }
> = {
	archive: {
		rpc: 'archive_invitation',
		success: true,
		notFound: 'Invitación no encontrada o ya archivada.',
	},
	restore: {
		rpc: 'restore_invitation',
		success: true,
		notFound: 'Invitación no encontrada en archivadas.',
	},
	permanent_delete: {
		rpc: 'permanently_delete_invitation',
		success: 'deleted',
		notFound: 'Invitación no encontrada en archivadas.',
	},
};

export async function mutateInvitationLifecycle(
	invitationId: string,
	action: InvitationLifecycleAction,
	context: InvitationMutationCommandContext,
): Promise<{
	success: true;
	mutation: Awaited<ReturnType<typeof recordInvitationMutationOutcome>>;
}> {
	const config = ACTIONS[action];
	let durableMutation = false;
	try {
		const result = await supabaseRestRequest<unknown>({
			pathWithQuery: `rpc/${config.rpc}`,
			method: 'POST',
			useServiceRole: true,
			body: { p_invitation_id: invitationId },
		});
		if (result === 'blocked_rsvp_history') {
			throw new ApiError(
				409,
				'conflict',
				'No se puede eliminar definitivamente esta invitación porque tiene actividad RSVP asociada. Puedes mantenerla archivada para conservar el historial.',
			);
		}
		if (result !== config.success) throw new ApiError(404, 'not_found', config.notFound);
		durableMutation = true;
		const mutation = await recordInvitationMutationOutcome({
			context,
			invitationId,
			commandKind: `invitation_${action}`,
			status: 'applied',
			completedSteps: [`${action}_completed`],
			result: { invitationId, action },
		});
		return { success: true, mutation };
	} catch (error) {
		if (!durableMutation) {
			await recordInvitationMutationOutcome({
				context,
				invitationId,
				commandKind: `invitation_${action}`,
				status: 'not_applied',
				error,
			});
		} else {
			throw new ApiError(
				503,
				'internal_error',
				'La acción se aplicó, pero su recibo falló.',
				{
					operationId: context.operationId,
					status: 'partial',
				},
			);
		}
		throw error;
	}
}
