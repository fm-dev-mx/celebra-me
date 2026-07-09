import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

type EventProperties = Record<string, unknown>;

export interface CommercialSessionRow {
	id: string;
	route_class: string;
	is_internal: boolean;
	source?: string | null;
	medium?: string | null;
	campaign?: string | null;
}

export interface CommercialEventRow {
	event_name: string;
	event_properties: EventProperties;
	source?: string | null;
	medium?: string | null;
	campaign?: string | null;
	consent_snapshot?: Record<string, unknown> | null;
	occurred_at?: string | null;
}

export interface CommercialLeadRow {
	status: string;
	channel: string;
	utm_source?: string | null;
	utm_medium?: string | null;
	utm_campaign?: string | null;
	lead_code?: string;
	name?: string;
	email?: string | null;
	phone?: string | null;
	event_type?: string | null;
	package_interest?: string | null;
	created_at?: string;
}

export interface CommercialDashboardRows {
	sessions: CommercialSessionRow[];
	events: CommercialEventRow[];
	leads: CommercialLeadRow[];
	orders?: SalesOrderSummaryRow[];
}

export interface SalesOrderSummaryRow {
	id: string;
	status: string;
	total_amount: number | string;
	amount_paid: number | string;
	deposit_amount?: number | string | null;
	event_type?: string | null;
	package_name?: string | null;
	created_at?: string;
	deposit_paid_at?: string | null;
}

export interface CountItem {
	label: string;
	count: number;
}

export interface CommercialDashboardSummary {
	totals: {
		sessions: number;
		internalSessions: number;
		ctaClicks: number;
		whatsappClicks: number;
		formSubmissions: number;
		demoViews: number;
		leads: number;
	};
	sales: {
		orders: number;
		depositsPaid: number;
		totalRevenue: number;
		averageTicket: number;
		conversionLeadToOrder: number;
	};
	ordersByStatus: CountItem[];
	topRevenueByEventType: CountItem[];
	topCtas: CountItem[];
	topDemos: CountItem[];
	scrollDepth: CountItem[];
	sections: CountItem[];
	campaigns: CountItem[];
	leadsByStatus: CountItem[];
	leadsByChannel: CountItem[];
	recentLeads: CommercialLeadRow[];
	/** Tracking quality — consent distribution */
	trackingQuality: {
		totalEvents: number;
		analyticsConsented: number;
		analyticsBlocked: number;
		marketingConsented: number;
		marketingBlocked: number;
		lastEventAt: string | null;
	};
}

const LEAD_STATUS_LABELS: Record<string, string> = {
	new: 'Nuevo',
	contacted: 'Contactado',
	quoted: 'Cotizado',
	production_authorized: 'Producción autorizada',
	paid: 'Pagado',
	converted_to_demo: 'Convertido a demo',
	lost: 'Perdido',
	spam: 'Spam',
};

const LEAD_CHANNEL_LABELS: Record<string, string> = {
	contact_form: 'Formulario',
	whatsapp: 'WhatsApp manual',
	manual: 'Manual',
};

export function labelLeadStatus(status: string | undefined | null): string {
	return status ? (LEAD_STATUS_LABELS[status] ?? status) : 'Sin estado';
}

export function labelLeadChannel(channel: string | undefined | null): string {
	return channel ? (LEAD_CHANNEL_LABELS[channel] ?? channel) : 'Sin canal';
}

function increment(map: Map<string, number>, label: string | undefined | null): void {
	const normalized = label?.trim() || 'Sin clasificar';
	map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toCountItems(map: Map<string, number>): CountItem[] {
	return [...map.entries()]
		.map(([label, count]) => ({ label, count }))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function campaignLabel(
	source?: string | null,
	medium?: string | null,
	campaign?: string | null,
): string {
	const parts = [source, medium, campaign].map((value) => value?.trim()).filter(Boolean);
	return parts.length ? parts.join(' / ') : 'Directo / sin campaña';
}

function propertyAsString(properties: EventProperties, key: string): string | undefined {
	const value = properties[key];
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	return undefined;
}

export function summarizeCommercialAnalytics(
	rows: CommercialDashboardRows,
): CommercialDashboardSummary {
	const externalSessions = rows.sessions.filter((session) => !session.is_internal);
	const internalSessions = rows.sessions.filter((session) => session.is_internal);
	const topCtas = new Map<string, number>();
	const topDemos = new Map<string, number>();
	const scrollDepth = new Map<string, number>();
	const sections = new Map<string, number>();
	const campaigns = new Map<string, number>();
	const leadsByStatus = new Map<string, number>();
	const leadsByChannel = new Map<string, number>();

	// Tracking quality consent distribution.
	let analyticsConsented = 0;
	let analyticsBlocked = 0;
	let marketingConsented = 0;
	let marketingBlocked = 0;

	externalSessions.forEach((session) => {
		increment(campaigns, campaignLabel(session.source, session.medium, session.campaign));
	});

	rows.events.forEach((event) => {
		increment(campaigns, campaignLabel(event.source, event.medium, event.campaign));
		if (event.event_name === 'cta_clicked' || event.event_name === 'whatsapp_contact_clicked') {
			increment(topCtas, propertyAsString(event.event_properties, 'cta_id'));
		}
		if (event.event_name === 'demo_viewed') {
			increment(topDemos, propertyAsString(event.event_properties, 'demo_slug'));
		}
		if (event.event_name === 'scroll_depth_reached') {
			const bucket = propertyAsString(event.event_properties, 'depth_bucket');
			increment(scrollDepth, bucket ? `${bucket}%` : undefined);
		}
		if (event.event_name === 'section_seen') {
			increment(sections, propertyAsString(event.event_properties, 'section_id'));
		}

		// Consent distribution.
		const snapshot = event.consent_snapshot;
		if (snapshot?.analytics === true) {
			analyticsConsented += 1;
		} else {
			analyticsBlocked += 1;
		}
		if (snapshot?.marketing === true) {
			marketingConsented += 1;
		} else {
			marketingBlocked += 1;
		}
	});

	// Last event timestamp.
	const timestamps = rows.events
		.map((e) => e.occurred_at)
		.filter((t): t is string => typeof t === 'string')
		.sort()
		.reverse();
	const lastEventAt = timestamps.length > 0 ? timestamps[0] : null;

	rows.leads.forEach((lead) => {
		increment(leadsByStatus, labelLeadStatus(lead.status));
		increment(leadsByChannel, labelLeadChannel(lead.channel));
		increment(campaigns, campaignLabel(lead.utm_source, lead.utm_medium, lead.utm_campaign));
	});

	// Sales summary
	const orders = rows.orders ?? [];
	const ordersByStatus = new Map<string, number>();
	const demosByRevenue = new Map<string, number>();
	let totalRevenue = 0;
	let depositsPaid = 0;

	for (const order of orders) {
		increment(ordersByStatus, order.status);

		const paid = Number(order.amount_paid) || 0;
		if (paid > 0) {
			totalRevenue += paid;
			depositsPaid++;
		}

		if (order.event_type && paid > 0) {
			const label = `${order.package_name || order.event_type}`;
			const existing = demosByRevenue.get(label) || 0;
			demosByRevenue.set(label, existing + paid);
		}
	}

	const leadsCount = rows.leads.length;
	const conversionLeadToOrder = leadsCount > 0
		? Math.round((orders.length / leadsCount) * 100)
		: 0;

	return {
		totals: {
			sessions: externalSessions.length,
			internalSessions: internalSessions.length,
			ctaClicks: rows.events.filter((event) => event.event_name === 'cta_clicked').length,
			whatsappClicks: rows.events.filter(
				(event) => event.event_name === 'whatsapp_contact_clicked',
			).length,
			formSubmissions: rows.events.filter((event) => event.event_name === 'form_submitted')
				.length,
			demoViews: rows.events.filter((event) => event.event_name === 'demo_viewed').length,
			leads: leadsCount,
		},
		sales: {
			orders: orders.length,
			depositsPaid,
			totalRevenue,
			averageTicket: depositsPaid > 0 ? Math.round(totalRevenue / depositsPaid) : 0,
			conversionLeadToOrder,
		},
		ordersByStatus: toCountItems(ordersByStatus),
		topRevenueByEventType: toCountItems(demosByRevenue).slice(0, 8),
		topCtas: toCountItems(topCtas).slice(0, 8),
		topDemos: toCountItems(topDemos).slice(0, 8),
		scrollDepth: toCountItems(scrollDepth),
		sections: toCountItems(sections).slice(0, 10),
		campaigns: toCountItems(campaigns).slice(0, 10),
		leadsByStatus: toCountItems(leadsByStatus),
		leadsByChannel: toCountItems(leadsByChannel),
		recentLeads: rows.leads.slice(0, 10),
		trackingQuality: {
			totalEvents: rows.events.length,
			analyticsConsented,
			analyticsBlocked,
			marketingConsented,
			marketingBlocked,
			lastEventAt,
		},
	};
}

export async function loadCommercialDashboardData(): Promise<CommercialDashboardSummary> {
	const [sessions, events, leads, orders] = await Promise.all([
		supabaseRestRequest<CommercialSessionRow[]>({
			pathWithQuery:
				'visitor_sessions?select=id,route_class,is_internal,source:utm_source,medium:utm_medium,campaign:utm_campaign&order=last_seen_at.desc&limit=1000',
			useServiceRole: true,
		}),
		supabaseRestRequest<CommercialEventRow[]>({
			pathWithQuery:
				'tracking_events?select=event_name,event_properties,source,medium,campaign,consent_snapshot,occurred_at&order=occurred_at.desc&limit=2000',
			useServiceRole: true,
		}),
		supabaseRestRequest<CommercialLeadRow[]>({
			pathWithQuery:
				'leads?select=lead_code,name,email,phone,event_type,package_interest,status,channel,utm_source,utm_medium,utm_campaign,created_at&order=created_at.desc&limit=200',
			useServiceRole: true,
		}),
		supabaseRestRequest<SalesOrderSummaryRow[]>({
			pathWithQuery:
				'sales_orders?select=id,status,event_type,package_name,total_amount,amount_paid,deposit_amount,created_at,deposit_paid_at&order=created_at.desc&limit=500',
			useServiceRole: true,
		}),
	]);

	return summarizeCommercialAnalytics({ sessions, events, leads, orders });
}
