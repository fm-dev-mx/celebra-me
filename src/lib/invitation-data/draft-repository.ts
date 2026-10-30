import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

export async function findOrderInvitationId(orderId: string): Promise<string | null> {
	const rows = await supabaseRestRequest<Array<{ invitation_id: string | null }>>({
		pathWithQuery: `sales_orders?id=eq.${encodeURIComponent(orderId)}&select=invitation_id&limit=1`,
		useServiceRole: true,
	});
	return rows[0]?.invitation_id ?? null;
}

export type OrderDraftResult = { invitationId: string; created: boolean } | { error: string };

export async function createOrderDraftAtomic(input: {
	orderId: string;
	expectedUpdatedAt: string;
	slug: string;
	themeId: string;
	content: DraftContent;
}): Promise<OrderDraftResult> {
	return supabaseRestRequest<OrderDraftResult>({
		pathWithQuery: 'rpc/create_order_invitation_draft',
		method: 'POST',
		useServiceRole: true,
		body: {
			p_order_id: input.orderId,
			p_expected_request_updated_at: input.expectedUpdatedAt,
			p_slug: input.slug,
			p_theme_id: input.themeId,
			p_content: input.content,
		},
	});
}
