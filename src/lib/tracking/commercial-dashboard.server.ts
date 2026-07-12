import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	summarizeCommercialAnalytics,
	type CommercialDashboardSummary,
	type CommercialEventRow,
	type CommercialLeadRow,
	type CommercialSessionRow,
	type ConversionSummaryRow,
	type HistoricalPaidOrderDiagnostic,
	type SalesOrderSummaryRow,
} from '@/lib/tracking/commercial-dashboard';
import {
	excludeClassifiedTestRecords,
	type CommercialRecordClassification,
} from '@/lib/tracking/commercial-classification';

export interface CommercialOutboxRow {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'ambiguous';
	attempt_count: number;
	last_error_message: string | null;
	created_at: string;
	next_attempt_at?: string | null;
	claimed_at?: string | null;
	claim_expires_at?: string | null;
	sent_at?: string | null;
	last_error_code?: string | null;
	provider_events_received?: number | null;
	provider_trace_id?: string | null;
	attempt_history?: CommercialAttemptRow[];
	recovery_history?: CommercialRecoveryRow[];
}

interface CommercialAttemptRow {
	conversion_event_id: string;
	attempt_number: number;
	started_at: string;
	completed_at: string | null;
	outcome: string | null;
	error_code: string | null;
	error_message: string | null;
}

interface CommercialRecoveryRow {
	conversion_event_id: string;
	reason: string;
	source_status: string;
	destination_status: string;
	created_at: string;
}

export async function loadCommercialDashboardData(): Promise<CommercialDashboardSummary> {
	const [sessions, events, leads, orders, conversions, classifications] = await Promise.all([
		supabaseRestRequest<CommercialSessionRow[]>({
			pathWithQuery:
				'visitor_sessions?select=id,route_class,is_internal,source:utm_source,medium:utm_medium,campaign:utm_campaign,last_seen_at&order=last_seen_at.desc&limit=1000',
			useServiceRole: true,
		}),
		supabaseRestRequest<CommercialEventRow[]>({
			pathWithQuery:
				'tracking_events?select=event_name,event_properties,source,medium,campaign,consent_snapshot,occurred_at,is_internal&order=occurred_at.desc&limit=2000',
			useServiceRole: true,
		}),
		supabaseRestRequest<CommercialLeadRow[]>({
			pathWithQuery:
				'leads?select=id,lead_code,customer_id,name,email,phone,phone_e164,event_type,package_interest,status,channel,utm_source,utm_medium,utm_campaign,created_at&order=created_at.desc&limit=200',
			useServiceRole: true,
		}),
		supabaseRestRequest<SalesOrderSummaryRow[]>({
			pathWithQuery:
				'sales_orders?select=id,order_number,customer_id,lead_id,status,event_type,package_name,total_amount,amount_paid,deposit_amount,created_at,deposit_paid_at&order=created_at.desc&limit=500',
			useServiceRole: true,
		}),
		supabaseRestRequest<ConversionSummaryRow[]>({
			pathWithQuery:
				'meta_conversion_events?select=id,order_id,lead_id,event_id,customer_id,status,created_at,updated_at,last_error_message,next_attempt_at,claimed_at,claim_expires_at&order=created_at.desc&limit=500',
			useServiceRole: true,
		}).catch(() => []),
		supabaseRestRequest<CommercialRecordClassification[]>({
			pathWithQuery:
				'commercial_record_classifications?classification=eq.test_qa&revoked_at=is.null&select=record_type,record_id&limit=2000',
			useServiceRole: true,
		}).catch(() => []),
	]);
	const commercialRows = excludeClassifiedTestRecords(
		{ leads, orders, conversions },
		classifications,
	);
	const historicalPaidOrdersWithoutPurchase: HistoricalPaidOrderDiagnostic[] = orders
		.filter(
			(order) =>
				(order.status === 'deposit_paid' || order.status === 'paid') &&
				!conversions.some(
					(conversion) =>
						conversion.event_id === `purchase:${order.id}:deposit_paid` &&
						conversion.order_id === order.id,
				),
		)
		.map((order) => ({
			orderId: order.id,
			orderNumber: order.order_number ?? null,
			customerId: order.customer_id ?? null,
			leadId: order.lead_id ?? null,
			status: order.status as 'deposit_paid' | 'paid',
			depositPaidAt: order.deposit_paid_at ?? null,
		}));
	return {
		...summarizeCommercialAnalytics({
			sessions,
			events,
			...commercialRows,
		}),
		historicalPaidOrdersWithoutPurchase,
	};
}

export async function loadCommercialDashboardOutbox(): Promise<CommercialOutboxRow[]> {
	const events = await supabaseRestRequest<CommercialOutboxRow[]>({
		pathWithQuery:
			'meta_conversion_events?select=id,event_name,event_id,value,currency,status,attempt_count,last_error_code,last_error_message,next_attempt_at,claimed_at,claim_expires_at,sent_at,provider_events_received,provider_trace_id,created_at&order=created_at.desc&limit=50',
		useServiceRole: true,
	});
	if (events.length === 0) return events;
	const ids = events.map((event) => encodeURIComponent(event.id)).join(',');
	const [attempts, recoveries] = await Promise.all([
		supabaseRestRequest<CommercialAttemptRow[]>({
			pathWithQuery: `meta_conversion_delivery_attempts?conversion_event_id=in.(${ids})&select=conversion_event_id,attempt_number,started_at,completed_at,outcome,error_code,error_message&order=started_at.desc&limit=500`,
			useServiceRole: true,
		}).catch(() => []),
		supabaseRestRequest<CommercialRecoveryRow[]>({
			pathWithQuery: `meta_conversion_recoveries?conversion_event_id=in.(${ids})&select=conversion_event_id,reason,source_status,destination_status,created_at&order=created_at.desc&limit=500`,
			useServiceRole: true,
		}).catch(() => []),
	]);
	return events.map((event) => ({
		...event,
		attempt_history: attempts.filter((attempt) => attempt.conversion_event_id === event.id),
		recovery_history: recoveries.filter(
			(recovery) => recovery.conversion_event_id === event.id,
		),
	}));
}
