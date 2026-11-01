import { ApiError } from '@/lib/rsvp/core/errors';
import { deterministicEventId } from '@/lib/rsvp/engagement/engagement.service';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { loadCommercialRows } from '@/lib/tracking/commercial-pagination.server';
import { resolvePublicSiteOrigin } from '@/lib/invitation/social-metadata';
import { getUsableWhatsAppE164 } from './phone';
import {
	QUOTE_REMINDER_ACTION,
	QUOTE_REMINDER_DELAY_MS,
	type QuoteReminderItem,
} from './quote-reminders';
import type { CrmTimelineEntry } from './crm-timeline.service';

interface ReminderLead {
	id: string;
	lead_code: string;
	name: string | null;
	customer_id: string | null;
	session_id: string | null;
	phone: string | null;
	phone_e164: string | null;
	consent_contact: boolean;
	status: string;
	created_at: string;
	updated_at: string;
}
interface ReminderAudit {
	id: string;
	target_id: string;
	created_at: string;
}

async function loadReminderCandidates(now: number) {
	const [leads, followups, sessions, events, orders, audits, classifications] = await Promise.all(
		[
			loadCommercialRows<ReminderLead>(
				'leads?status=eq.quoted&select=id,lead_code,name,customer_id,session_id,phone,phone_e164,consent_contact,status,created_at,updated_at',
			),
			loadCommercialRows<{ id: string; lead_id: string; occurred_at: string }>(
				'commercial_demo_followups?select=id,lead_id,occurred_at',
			),
			loadCommercialRows<{ id: string; last_seen_at: string }>(
				'visitor_sessions?is_internal=is.false&select=id,last_seen_at',
			),
			loadCommercialRows<{
				id: string;
				occurred_at: string;
				event_properties: { lead_code?: string };
			}>(
				'tracking_events?is_internal=is.false&event_properties->>lead_code=not.is.null&select=id,occurred_at,event_properties',
			),
			loadCommercialRows<{
				id: string;
				lead_id: string | null;
				customer_id: string | null;
				status: string;
				updated_at: string;
			}>('sales_orders?select=id,lead_id,customer_id,status,updated_at'),
			loadCommercialRows<ReminderAudit>(
				'audit_logs?target_table=eq.leads&select=id,target_id,created_at',
			),
			loadCommercialRows<{ id: string; record_type: string; record_id: string }>(
				'commercial_record_classifications?classification=eq.test_qa&revoked_at=is.null&select=id,record_type,record_id',
			),
		],
	);
	const classified = new Set(classifications.map((row) => `${row.record_type}:${row.record_id}`));
	return leads
		.flatMap((lead) => {
			if (classified.has(`lead:${lead.id}`) || classified.has(`customer:${lead.customer_id}`))
				return [];
			const relatedOrders = orders.filter(
				(row) =>
					row.lead_id === lead.id ||
					(lead.customer_id && row.customer_id === lead.customer_id),
			);
			if (relatedOrders.some((row) => row.status === 'deposit_paid' || row.status === 'paid'))
				return [];
			const timestamps = [
				lead.created_at,
				lead.updated_at,
				...followups.filter((row) => row.lead_id === lead.id).map((row) => row.occurred_at),
				...sessions
					.filter((row) => row.id === lead.session_id)
					.map((row) => row.last_seen_at),
				...events
					.filter((row) => row.event_properties?.lead_code === lead.lead_code)
					.map((row) => row.occurred_at),
				...relatedOrders.map((row) => row.updated_at),
				...audits.filter((row) => row.target_id === lead.id).map((row) => row.created_at),
			];
			// Incomplete dates must not turn an uncertain opportunity into a reminder candidate.
			const times = timestamps.map(Date.parse);
			if (times.some((time) => !Number.isFinite(time))) return [];
			const lastActivity = Math.max(...times);
			if (lastActivity > now - QUOTE_REMINDER_DELAY_MS) return [];
			return [{ lead, lastActivityAt: new Date(lastActivity).toISOString() }];
		})
		.sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt));
}

export async function loadQuoteReminders(now = Date.now()): Promise<QuoteReminderItem[]> {
	return (await loadReminderCandidates(now)).map(({ lead, lastActivityAt }) => ({
		id: lead.id,
		leadCode: lead.lead_code,
		name: lead.name,
		customerId: lead.customer_id,
		lastActivityAt,
		canRemind:
			lead.consent_contact && Boolean(getUsableWhatsAppE164(lead.phone_e164, lead.phone)),
	}));
}

export function buildQuoteReminderIdempotencyKey(leadId: string, now = Date.now()) {
	const day = new Date(now).toISOString().slice(0, 10);
	return `quote-reminder:${leadId}:${day}`;
}

export async function prepareQuoteReminder(input: { leadId: string }, actorId: string) {
	const now = Date.now();
	const idempotencyKey = buildQuoteReminderIdempotencyKey(input.leadId, now);
	const auditId = deterministicEventId(idempotencyKey);
	const existing = await supabaseRestRequest<ReminderAudit[]>({
		pathWithQuery: `audit_logs?id=eq.${encodeURIComponent(auditId)}&select=id,target_id,created_at&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	if (existing[0])
		throw new ApiError(
			409,
			'conflict',
			'El recordatorio ya fue preparado. Actualice el historial.',
		);
	const candidate = (await loadReminderCandidates(now)).find(
		({ lead }) => lead.id === input.leadId,
	);
	if (!candidate)
		throw new ApiError(
			409,
			'conflict',
			'La cotización ya no requiere recordatorio. Actualice la lista.',
		);
	const { lead } = candidate;
	const digits = getUsableWhatsAppE164(lead.phone_e164, lead.phone);
	if (!lead.consent_contact || !digits)
		throw new ApiError(
			400,
			'bad_request',
			'Se requiere permiso de contacto y un teléfono con código de país.',
		);
	const link = new URL('/', resolvePublicSiteOrigin());
	link.searchParams.set('lead_code', lead.lead_code);
	link.searchParams.set('utm_source', 'whatsapp');
	link.searchParams.set('utm_medium', 'manual');
	link.searchParams.set('utm_campaign', 'quote_reminder');
	const message = `Hola${lead.name ? `, ${lead.name}` : ''}. ¿Desea continuar con la cotización de su invitación? Puede revisar las opciones aquí: ${link.href}\nFolio ${lead.lead_code}`;
	const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
	// A durable audit is required before offering the manual draft. Never claim delivery.
	const rows = await supabaseRestRequest<ReminderAudit[]>({
		pathWithQuery: 'audit_logs?on_conflict=id&select=id,target_id,created_at',
		method: 'POST',
		useServiceRole: true,
		prefer: 'resolution=ignore-duplicates,return=representation',
		body: {
			id: auditId,
			actor_id: actorId,
			action: QUOTE_REMINDER_ACTION,
			target_table: 'leads',
			target_id: lead.id,
			new_data: { lead_code: lead.lead_code, idempotency_key: idempotencyKey },
		},
	});
	if (!rows[0])
		throw new ApiError(
			409,
			'conflict',
			'El recordatorio ya fue preparado. Actualice el historial.',
		);
	return { whatsappUrl, entry: reminderTimelineEntry(rows[0]) };
}

function reminderTimelineEntry(row: ReminderAudit): CrmTimelineEntry {
	return {
		id: `quote-reminder:${row.id}`,
		eventType: 'quote_reminder_prepared',
		label: 'Recordatorio preparado',
		description: 'Se preparó un borrador manual de WhatsApp. El envío no está confirmado.',
		occurredAt: row.created_at,
	};
}

export async function loadQuoteReminderTimeline(filter: {
	customerId?: string;
	leadId?: string;
}): Promise<CrmTimelineEntry[]> {
	const leads = filter.leadId
		? [{ id: filter.leadId }]
		: await loadCommercialRows<{ id: string }>(
				`leads?customer_id=eq.${encodeURIComponent(filter.customerId!)}&select=id`,
			);
	const ids = new Set(leads.map((lead) => lead.id));
	if (!ids.size) return [];
	const rows = await loadCommercialRows<ReminderAudit>(
		`audit_logs?target_table=eq.leads&action=eq.${QUOTE_REMINDER_ACTION}&select=id,target_id,created_at`,
	);
	return rows.filter((row) => ids.has(row.target_id)).map(reminderTimelineEntry);
}
