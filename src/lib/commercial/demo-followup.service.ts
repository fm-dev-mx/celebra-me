import { loadDemoInventory } from './demo-inventory.server';
import { ApiError } from '@/lib/rsvp/core/errors';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { findLeadByCode, upsertLead } from '@/lib/tracking/lead.repository';
import { DemoFollowupSchema, type DemoFollowupInput, type DemoFollowupRow } from './demo-followup';

export async function recordDemoFollowup(input: DemoFollowupInput, actorId: string) {
	const data = DemoFollowupSchema.parse(input);
	const demo = (await loadDemoInventory()).find((item) => item.slug === data.demoSlug);
	if (!demo || Date.parse(data.occurredAt) > Date.now()) {
		throw new ApiError(400, 'bad_request', 'Demo o fecha no válida.');
	}
	// Check schema availability before creating any opportunity.
	await supabaseRestRequest({
		pathWithQuery: 'commercial_demo_followups?select=id&limit=0',
		method: 'GET',
		useServiceRole: true,
	});
	let lead = await findLeadByCode(data.leadCode);
	if (!lead) {
		if (data.action !== 'demo_shared' && data.action !== 'contact_received') {
			throw new ApiError(400, 'bad_request', 'Registre primero la oportunidad comercial.');
		}
		lead = await upsertLead({
			leadCode: data.leadCode,
			channel: 'manual',
			eventType: demo.eventType,
			consentContact: data.action === 'contact_received',
			consentMarketing: false,
		});
	}
	const rows = await supabaseRestRequest<DemoFollowupRow[]>({
		pathWithQuery:
			'commercial_demo_followups?on_conflict=lead_id,demo_slug,action&select=id,lead_id,demo_slug,action,loss_reason,occurred_at',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			id: data.idempotencyKey,
			lead_id: lead.id,
			demo_slug: demo.slug,
			action: data.action,
			loss_reason: data.action === 'lost' ? data.lossReason : 'not_reported',
			occurred_at: data.occurredAt,
			created_by: actorId,
		},
	});
	if (rows[0]) return rows[0];
	const existing = await supabaseRestRequest<DemoFollowupRow[]>({
		pathWithQuery: `commercial_demo_followups?lead_id=eq.${encodeURIComponent(lead.id)}&demo_slug=eq.${encodeURIComponent(demo.slug)}&action=eq.${data.action}&select=id,lead_id,demo_slug,action,loss_reason,occurred_at`,
		method: 'GET',
		useServiceRole: true,
	});
	if (!existing[0]) throw new ApiError(409, 'conflict', 'No se pudo confirmar el registro.');
	return existing[0];
}
