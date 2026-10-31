import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

export const META_CRM_LEAD_EVENT_SOURCE = 'Celebra-me';

/**
 * Custom stages go out as system events. The sales stages the owner marks on a landing lead's
 * card follow the WhatsApp conversation, so they go out as chat events: a qualified lead is a
 * standard Lead and a confirmed order is the lead's single Purchase, valued at its package.
 */
export const META_CRM_LEAD_STAGE_EVENTS = {
	quoted: {
		eventName: 'LeadQuoted',
		triggerStatus: 'crm_lead_quoted',
		actionSource: 'system_generated',
	},
	paid: {
		eventName: 'LeadPaid',
		triggerStatus: 'crm_lead_paid',
		actionSource: 'system_generated',
	},
	lost: {
		eventName: 'LeadLost',
		triggerStatus: 'crm_lead_lost',
		actionSource: 'system_generated',
	},
	qualified: { eventName: 'Lead', triggerStatus: 'crm_lead_qualified', actionSource: 'chat' },
	order_confirmed: {
		eventName: 'Purchase',
		triggerStatus: 'crm_lead_order_confirmed',
		actionSource: 'chat',
	},
} as const;

/** Meta rejects chat events whose event time is older than seven days. */
export const META_CHAT_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * Queue one idempotent CRM stage only when the lead has marketing consent. The stable event ID
 * keeps one row per lead and stage, so marking a stage again never sends it twice.
 */
export async function enqueueMetaCrmLeadStageEvent(input: {
	leadId: string;
	stage: MetaCrmLeadStage;
	/** Package value in MXN; only the confirmed-order Purchase carries one. */
	value?: number;
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
			value: input.value ?? null,
			status: 'pending',
		},
	});
}

/**
 * Sales stages of a landing lead: qualifying sends Lead, and confirming the order also counts as
 * qualifying, then sends the Purchase with the package value. Chat leads are left out: they are
 * captured without marketing consent.
 */
export async function enqueueMetaCrmLeadSalesStageEvents(lead: {
	id: string;
	route: string | null;
	stage: string;
	packageValue: number | null;
}): Promise<void> {
	if (lead.route !== 'landing') return;
	if (lead.stage !== 'qualified' && lead.stage !== 'order_confirmed') return;
	await enqueueMetaCrmLeadStageEvent({ leadId: lead.id, stage: 'qualified' });
	if (lead.stage === 'order_confirmed' && lead.packageValue !== null && lead.packageValue > 0) {
		await enqueueMetaCrmLeadStageEvent({
			leadId: lead.id,
			stage: 'order_confirmed',
			value: lead.packageValue,
		});
	}
}
