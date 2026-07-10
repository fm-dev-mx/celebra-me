import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	summarizeCommercialAnalytics,
	type CommercialDashboardSummary,
	type CommercialEventRow,
	type CommercialLeadRow,
	type CommercialSessionRow,
	type ConversionSummaryRow,
	type SalesOrderSummaryRow,
} from '@/lib/tracking/commercial-dashboard';

export interface CommercialOutboxRow {
	id: string;
	event_name: string;
	event_id: string;
	value: number;
	currency: string;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
	attempt_count: number;
	last_error_message: string | null;
	created_at: string;
}

export async function loadCommercialDashboardData(): Promise<CommercialDashboardSummary> {
	const [sessions, events, leads, orders, conversions] = await Promise.all([
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
				'sales_orders?select=id,status,event_type,package_name,total_amount,amount_paid,deposit_amount,created_at,deposit_paid_at&order=created_at.desc&limit=500',
			useServiceRole: true,
		}),
		supabaseRestRequest<ConversionSummaryRow[]>({
			pathWithQuery:
				'meta_conversion_events?select=id,order_id,status,created_at,updated_at,last_error_message&order=created_at.desc&limit=500',
			useServiceRole: true,
		}).catch(() => []),
	]);

	return summarizeCommercialAnalytics({ sessions, events, leads, orders, conversions });
}

export function loadCommercialDashboardOutbox(): Promise<CommercialOutboxRow[]> {
	return supabaseRestRequest<CommercialOutboxRow[]>({
		pathWithQuery:
			'meta_conversion_events?select=id,event_name,event_id,value,currency,status,attempt_count,last_error_message,created_at&order=created_at.desc&limit=50',
		useServiceRole: true,
	});
}
