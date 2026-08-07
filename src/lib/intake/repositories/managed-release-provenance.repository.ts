import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

/**
 * Clear the managed merge ancestor after an editor publish so the next
 * invitation:release uses published content as the 3-way baseline.
 * No-op when provenance does not exist for the invitation.
 */
export async function clearManagedProjectionAncestor(invitationId: string): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: `managed_invitation_release_provenance?invitation_id=eq.${encodeURIComponent(invitationId)}`,
		method: 'PATCH',
		body: {
			managed_projection: null,
			applied_draft_updated_at: null,
			applied_operation_id: null,
			applied_published_version: null,
			applied_published_projection_hash: null,
		},
		useServiceRole: true,
		prefer: 'return=minimal',
	});
}
