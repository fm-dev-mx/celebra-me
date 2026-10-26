import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export const META_CRM_LEAD_EVENT_SOURCE = 'Celebra-me';

export const META_CRM_LEAD_STAGE_EVENTS = {
	quoted: { eventName: 'LeadQuoted', triggerStatus: 'crm_lead_quoted' },
	paid: { eventName: 'LeadPaid', triggerStatus: 'crm_lead_paid' },
	lost: { eventName: 'LeadLost', triggerStatus: 'crm_lead_lost' },
} as const;

export type MetaCrmLeadStage = keyof typeof META_CRM_LEAD_STAGE_EVENTS;

export function getMetaCrmLeadStageEvent(stage: string) {
	return Object.hasOwn(META_CRM_LEAD_STAGE_EVENTS, stage)
		? META_CRM_LEAD_STAGE_EVENTS[stage as MetaCrmLeadStage]
		: undefined;
}

export function getMetaCrmLeadStageFromTriggerStatus(
	triggerStatus: string,
): MetaCrmLeadStage | undefined {
	return (
		Object.entries(META_CRM_LEAD_STAGE_EVENTS) as Array<
			[MetaCrmLeadStage, (typeof META_CRM_LEAD_STAGE_EVENTS)[MetaCrmLeadStage]]
		>
	).find(([, event]) => event.triggerStatus === triggerStatus)?.[0];
}

export function getMetaCrmLeadStageForFollowupAction(action: string): MetaCrmLeadStage | undefined {
	if (action === 'quote_sent') return 'quoted';
	if (action === 'lost') return 'lost';
	return undefined;
}

export function createMetaCrmLeadStageEventId(leadId: string, stage: MetaCrmLeadStage): string {
	return `crm-lead-stage:${leadId}:${stage}`;
}

interface LeadConsentRow {
	id: string;
	session_id: string | null;
	consent_marketing: boolean | null;
}

/** Queue one idempotent CRM stage only when the lead has marketing consent. */
export async function enqueueMetaCrmLeadStageEvent(input: {
	leadId: string;
	stage: MetaCrmLeadStage;
}): Promise<void> {
	const event = META_CRM_LEAD_STAGE_EVENTS[input.stage];
	const rows = await supabaseRestRequest<LeadConsentRow[]>({
		pathWithQuery: `leads?id=eq.${encodeURIComponent(input.leadId)}&select=id,session_id,consent_marketing&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	const lead = rows[0];
	if (!lead || lead.consent_marketing !== true) return;

	await supabaseRestRequest<unknown>({
		pathWithQuery: 'meta_conversion_events?on_conflict=event_id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=minimal',
		body: {
			event_name: event.eventName,
			event_id: createMetaCrmLeadStageEventId(lead.id, input.stage),
			trigger_status: event.triggerStatus,
			lead_id: lead.id,
			session_id: lead.session_id,
			value: null,
			status: 'pending',
		},
	});
}
