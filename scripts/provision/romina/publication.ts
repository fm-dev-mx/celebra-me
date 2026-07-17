import { ROMINA_EVENT } from '../../dev/romina-invitation-data';
import type { DbClient } from './types';
import type { PhaseAction } from './types';
import type { PublicationRpcReturn } from './types';

// ---------------------------------------------------------------------------
// Publication via RPC
// ---------------------------------------------------------------------------

export async function publishInvitation(
	supabase: DbClient,
	invitationId: string,
	draftId: string,
	expectedDraftUpdatedAt: string,
	content: Record<string, unknown>,
): Promise<{ version: number; action: PhaseAction }> {
	const { data, error } = await supabase.rpc('publish_invitation_atomic', {
		p_invitation_id: invitationId,
		p_draft_id: draftId,
		p_expected_draft_updated_at: expectedDraftUpdatedAt,
		p_slug: ROMINA_EVENT.slug,
		p_event_type: ROMINA_EVENT.eventType,
		p_is_demo: false,
		p_content: content,
	});

	if (error) throw new Error(`Publication RPC failed: ${error.message}`);

	const result = data as PublicationRpcReturn | undefined;
	const version = result?.publishedContent?.version ?? 0;

	return {
		version,
		action: {
			resource: 'published_invitation_content',
			action: version > 1 ? 'replace' : 'create',
			detail: `Published version ${version}`,
		},
	};
}

// ---------------------------------------------------------------------------
// Event membership creation
// ---------------------------------------------------------------------------

export async function ensureEventMembership(
	supabase: DbClient,
	invitationId: string,
	ownerUserId: string,
): Promise<PhaseAction> {
	const { data: event } = await supabase
		.from('events')
		.select('id')
		.eq('invitation_project_id', invitationId)
		.is('deleted_at', null)
		.maybeSingle();

	const eventRow = event as Record<string, unknown> | null;
	if (!eventRow)
		return { resource: 'event_memberships', action: 'skip', detail: 'No event found yet' };

	const { data: existingMembership } = await supabase
		.from('event_memberships')
		.select('id')
		.eq('event_id', eventRow.id as string)
		.eq('user_id', ownerUserId)
		.eq('membership_role', 'owner')
		.is('deleted_at', null)
		.maybeSingle();

	const existingMembershipRow = existingMembership as Record<string, unknown> | null;
	if (existingMembershipRow)
		return {
			resource: 'event_memberships',
			action: 'reuse',
			detail: 'Owner membership already exists',
		};

	const { error } = await supabase.from('event_memberships').insert({
		event_id: eventRow.id as string,
		user_id: ownerUserId,
		membership_role: 'owner',
	} as Record<string, unknown>);

	if (error) throw new Error(`Failed to create event membership: ${error.message}`);
	return { resource: 'event_memberships', action: 'create', detail: 'Created owner membership' };
}
