type EventProperties = Record<string, unknown>;

export interface CommercialSessionRow {
	id: string;
	route_class: string;
	is_internal: boolean;
	source?: string | null;
	medium?: string | null;
	campaign?: string | null;
	last_seen_at?: string | null;
}

export interface CommercialEventRow {
	event_name: string;
	event_properties: EventProperties;
	source?: string | null;
	medium?: string | null;
	campaign?: string | null;
	consent_snapshot?: Record<string, unknown> | null;
	occurred_at?: string | null;
	is_internal?: boolean | null;
}

export interface CommercialLeadRow {
	id?: string;
	status: string;
	channel: string;
	customer_id?: string | null;
	utm_source?: string | null;
	utm_medium?: string | null;
	utm_campaign?: string | null;
	lead_code?: string;
	name?: string;
	email?: string | null;
	phone?: string | null;
	phone_e164?: string | null;
	event_type?: string | null;
	package_interest?: string | null;
	created_at?: string;
}

export interface CommercialDashboardRows {
	sessions: CommercialSessionRow[];
	events: CommercialEventRow[];
	leads: CommercialLeadRow[];
	orders?: SalesOrderSummaryRow[];
	conversions?: ConversionSummaryRow[];
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

export interface ConversionSummaryRow {
	id: string;
	order_id?: string | null;
	status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
	created_at?: string | null;
	updated_at?: string | null;
	last_error_message?: string | null;
}

export interface CountItem {
	label: string;
	count: number;
}

export interface DataContextSummary {
	periodLabel: string;
	scopeLabel: string;
	limitNotice: string;
	lastActivityAt: string | null;
	lastTrackingEventAt: string | null;
	lastCommercialUpdateAt: string | null;
}

export interface KeyTrackingEventCounts {
	pageViewed: number;
	demoViewed: number;
	ctaClicked: number;
	whatsappClicked: number;
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
	conversionStatusCounts: Record<ConversionSummaryRow['status'], number>;
	ordersWithPendingBalance: number;
	ordersWithDepositMissingCapi: number;
	ordersWithInconsistentValues: number;
	keyTrackingEventCounts: KeyTrackingEventCounts;
	lastConversionAttemptAt: string | null;
	dataContext: DataContextSummary;
	/** Tracking quality — consent distribution */
	trackingQuality: {
		totalEvents: number;
		analyticsConsented: number;
		analyticsBlocked: number;
		marketingConsented: number;
		marketingBlocked: number;
	};
}

export type HealthSeverity = 'correct' | 'attention' | 'error' | 'safe-disabled';

export interface CommercialMetricCard {
	id: string;
	label: string;
	value: string;
	helper?: string;
	muted?: boolean;
}

export interface CommercialHealthCheck {
	label: string;
	status: HealthSeverity;
	value: string;
	helper?: string;
}

export interface CommercialHealthWarning {
	label: string;
	count: number;
	severity: Extract<HealthSeverity, 'attention' | 'error'>;
	helper: string;
}

export interface CommercialDashboardViewModel {
	trafficCards: CommercialMetricCard[];
	salesCards: CommercialMetricCard[];
	trackingQualityCards: CommercialMetricCard[];
	executiveMetrics: CommercialMetricCard[];
	activeAlerts: number;
	health: {
		tracking: {
			status: HealthSeverity;
			label: string;
			message: string;
			checks: CommercialHealthCheck[];
		};
		capi: {
			status: HealthSeverity;
			label: string;
			message: string;
			checks: CommercialHealthCheck[];
		};
		commercial: {
			status: HealthSeverity;
			label: string;
			message: string;
			warnings: CommercialHealthWarning[];
		};
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

const QUERY_LIMIT_NOTICE =
	'Basado en los últimos registros cargados: 1000 sesiones, 2000 eventos, 200 leads, 500 órdenes y 500 conversiones.';

const EMPTY_CONVERSION_COUNTS: Record<ConversionSummaryRow['status'], number> = {
	pending: 0,
	sending: 0,
	sent: 0,
	failed: 0,
	skipped: 0,
};

const TRACKING_EVENT = {
	PAGE_VIEWED: 'page_viewed',
	DEMO_VIEWED: 'demo_viewed',
	CTA_CLICKED: 'cta_clicked',
	WHATSAPP_CONTACT_CLICKED: 'whatsapp_contact_clicked',
	FORM_SUBMITTED: 'form_submitted',
	SCROLL_DEPTH_REACHED: 'scroll_depth_reached',
	SECTION_SEEN: 'section_seen',
} as const;

export function formatCount(value: number): string {
	return new Intl.NumberFormat('es-MX').format(value);
}

export function formatCurrency(value: number, fractionDigits: number = 2): string {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN',
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: Math.max(fractionDigits, 2),
	}).format(value);
}

export function formatDateTime(value: string | null | undefined): string {
	if (value == null) return 'Sin datos';
	const _d = new Date(value);
	if (isNaN(_d.getTime())) return 'Fecha inválida';
	return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(_d);
}

function latestDate(values: Array<string | null | undefined>): string | null {
	const sorted = values
		.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
		.sort()
		.reverse();
	return sorted[0] ?? null;
}

function countConversionsByStatus(
	conversions: ConversionSummaryRow[],
): Record<ConversionSummaryRow['status'], number> {
	const counts = { ...EMPTY_CONVERSION_COUNTS };
	for (const conversion of conversions) {
		counts[conversion.status] += 1;
	}
	return counts;
}

/**
 * Build single-pass event metrics: histograms, consent distribution, event counts, latest timestamp.
 * Replaces repeated filter()+length calls with one O(n) pass.
 */
function summarizeEventMetrics(externalEvents: CommercialEventRow[]) {
	const topCtas = new Map<string, number>();
	const topDemos = new Map<string, number>();
	const scrollDepth = new Map<string, number>();
	const sections = new Map<string, number>();
	const campaignMap = new Map<string, number>();
	const eventCounts: Record<string, number> = {};

	let analyticsConsented = 0;
	let analyticsBlocked = 0;
	let marketingConsented = 0;
	let marketingBlocked = 0;
	let lastEventAt: string | null = null;

	for (const event of externalEvents) {
		eventCounts[event.event_name] = (eventCounts[event.event_name] ?? 0) + 1;
		increment(campaignMap, campaignLabel(event.source, event.medium, event.campaign));

		if (
			event.event_name === TRACKING_EVENT.CTA_CLICKED ||
			event.event_name === TRACKING_EVENT.WHATSAPP_CONTACT_CLICKED
		) {
			increment(topCtas, propertyAsString(event.event_properties, 'cta_id'));
		}
		if (event.event_name === TRACKING_EVENT.DEMO_VIEWED) {
			increment(topDemos, propertyAsString(event.event_properties, 'demo_slug'));
		}
		if (event.event_name === TRACKING_EVENT.SCROLL_DEPTH_REACHED) {
			const bucket = propertyAsString(event.event_properties, 'depth_bucket');
			increment(scrollDepth, bucket ? `${bucket}%` : undefined);
		}
		if (event.event_name === TRACKING_EVENT.SECTION_SEEN) {
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

		// Latest event timestamp (single-pass, no sort needed).
		if (event.occurred_at && (!lastEventAt || event.occurred_at > lastEventAt)) {
			lastEventAt = event.occurred_at;
		}
	}

	return {
		topCtas,
		topDemos,
		scrollDepth,
		sections,
		campaignMap,
		analyticsConsented,
		analyticsBlocked,
		marketingConsented,
		marketingBlocked,
		lastEventAt,
		eventCounts,
	};
}

function processOrderMetrics(orders: SalesOrderSummaryRow[], conversions: ConversionSummaryRow[]) {
	const ordersByStatus = new Map<string, number>();
	const revenueByEventType = new Map<string, number>();
	const conversionOrderIds = new Set(
		conversions
			.map((c) => c.order_id)
			.filter((id): id is string => typeof id === 'string' && id.length > 0),
	);

	let totalRevenue = 0;
	let depositsPaid = 0;
	let ordersWithPendingBalance = 0;
	let ordersWithDepositMissingCapi = 0;
	let ordersWithInconsistentValues = 0;

	for (const order of orders) {
		increment(ordersByStatus, order.status);

		const paid = Number(order.amount_paid) || 0;
		const total = Number(order.total_amount) || 0;
		if (total > paid) ordersWithPendingBalance++;
		if (paid > total) ordersWithInconsistentValues++;
		if (paid > 0) {
			totalRevenue += paid;
			depositsPaid++;
		}
		if (paid > 0 && !conversionOrderIds.has(order.id)) {
			ordersWithDepositMissingCapi++;
		}
		if (order.event_type && paid > 0) {
			const label = `${order.package_name || order.event_type}`;
			revenueByEventType.set(label, (revenueByEventType.get(label) ?? 0) + paid);
		}
	}

	const conversionStatusCounts = countConversionsByStatus(conversions);
	const lastConversionAttemptAt = latestDate(
		conversions.map((c) => c.updated_at ?? c.created_at),
	);

	return {
		ordersByStatus,
		revenueByEventType,
		totalRevenue,
		depositsPaid,
		ordersWithPendingBalance,
		ordersWithDepositMissingCapi,
		ordersWithInconsistentValues,
		conversionStatusCounts,
		lastConversionAttemptAt,
	};
}

function computeDataContext(
	externalSessions: CommercialSessionRow[],
	externalEvents: CommercialEventRow[],
	leads: CommercialLeadRow[],
	orders: SalesOrderSummaryRow[],
	lastConversionAttemptAt: string | null,
	lastEventAt: string | null,
): DataContextSummary {
	return {
		periodLabel: 'Mostrando datos históricos disponibles',
		scopeLabel: 'Sin filtro de fechas activo',
		limitNotice: QUERY_LIMIT_NOTICE,
		lastTrackingEventAt: lastEventAt,
		lastCommercialUpdateAt: latestDate([
			...leads.map((l) => l.created_at),
			...orders.map((o) => o.deposit_paid_at ?? o.created_at),
			lastConversionAttemptAt,
		]),
		lastActivityAt: latestDate([
			...externalSessions.map((s) => s.last_seen_at),
			...externalEvents.map((e) => e.occurred_at),
			...leads.map((l) => l.created_at),
			...orders.map((o) => o.deposit_paid_at ?? o.created_at),
			lastConversionAttemptAt,
		]),
	};
}

/** @internal Not part of public API — only used by loadCommercialDashboardData and tests */
export function summarizeCommercialAnalytics(
	rows: CommercialDashboardRows,
): CommercialDashboardSummary {
	const externalSessions = rows.sessions.filter((session) => !session.is_internal);
	const internalSessions = rows.sessions.filter((session) => session.is_internal);
	const externalEvents = rows.events.filter((event) => event.is_internal !== true);
	const leads = rows.leads;
	const orders = rows.orders ?? [];
	const conversions = rows.conversions ?? [];

	// Campaigns from sessions.
	const campaignMap = new Map<string, number>();
	externalSessions.forEach((session) => {
		increment(campaignMap, campaignLabel(session.source, session.medium, session.campaign));
	});

	// Events: everything in one pass.
	const eventMetrics = summarizeEventMetrics(externalEvents);
	// Merge session-based campaigns with event-derived ones.
	for (const [label, count] of eventMetrics.campaignMap) {
		campaignMap.set(label, (campaignMap.get(label) ?? 0) + count);
	}

	// Leads.
	const leadsByStatus = new Map<string, number>();
	const leadsByChannel = new Map<string, number>();
	leads.forEach((lead) => {
		increment(leadsByStatus, labelLeadStatus(lead.status));
		increment(leadsByChannel, labelLeadChannel(lead.channel));
		increment(campaignMap, campaignLabel(lead.utm_source, lead.utm_medium, lead.utm_campaign));
	});

	// Orders & conversions.
	const salesMetrics = processOrderMetrics(orders, conversions);

	const leadsCount = leads.length;
	const conversionLeadToOrder =
		leadsCount > 0 ? Math.round((orders.length / leadsCount) * 100) : 0;

	const keyTrackingEventCounts: KeyTrackingEventCounts = {
		pageViewed: eventMetrics.eventCounts[TRACKING_EVENT.PAGE_VIEWED] ?? 0,
		demoViewed: eventMetrics.eventCounts[TRACKING_EVENT.DEMO_VIEWED] ?? 0,
		ctaClicked: eventMetrics.eventCounts[TRACKING_EVENT.CTA_CLICKED] ?? 0,
		whatsappClicked: eventMetrics.eventCounts[TRACKING_EVENT.WHATSAPP_CONTACT_CLICKED] ?? 0,
	};

	return {
		totals: {
			sessions: externalSessions.length,
			internalSessions: internalSessions.length,
			ctaClicks: eventMetrics.eventCounts[TRACKING_EVENT.CTA_CLICKED] ?? 0,
			whatsappClicks: eventMetrics.eventCounts[TRACKING_EVENT.WHATSAPP_CONTACT_CLICKED] ?? 0,
			formSubmissions: eventMetrics.eventCounts[TRACKING_EVENT.FORM_SUBMITTED] ?? 0,
			demoViews: eventMetrics.eventCounts[TRACKING_EVENT.DEMO_VIEWED] ?? 0,
			leads: leadsCount,
		},
		sales: {
			orders: orders.length,
			depositsPaid: salesMetrics.depositsPaid,
			totalRevenue: salesMetrics.totalRevenue,
			averageTicket:
				salesMetrics.depositsPaid > 0
					? Math.round(salesMetrics.totalRevenue / salesMetrics.depositsPaid)
					: 0,
			conversionLeadToOrder,
		},
		ordersByStatus: toCountItems(salesMetrics.ordersByStatus),
		topRevenueByEventType: toCountItems(salesMetrics.revenueByEventType).slice(0, 8),
		topCtas: toCountItems(eventMetrics.topCtas).slice(0, 8),
		topDemos: toCountItems(eventMetrics.topDemos).slice(0, 8),
		scrollDepth: toCountItems(eventMetrics.scrollDepth),
		sections: toCountItems(eventMetrics.sections).slice(0, 10),
		campaigns: toCountItems(campaignMap).slice(0, 10),
		leadsByStatus: toCountItems(leadsByStatus),
		leadsByChannel: toCountItems(leadsByChannel),
		recentLeads: leads.slice(0, 10),
		conversionStatusCounts: salesMetrics.conversionStatusCounts,
		ordersWithPendingBalance: salesMetrics.ordersWithPendingBalance,
		ordersWithDepositMissingCapi: salesMetrics.ordersWithDepositMissingCapi,
		ordersWithInconsistentValues: salesMetrics.ordersWithInconsistentValues,
		keyTrackingEventCounts,
		lastConversionAttemptAt: salesMetrics.lastConversionAttemptAt,
		dataContext: computeDataContext(
			externalSessions,
			externalEvents,
			leads,
			orders,
			salesMetrics.lastConversionAttemptAt,
			eventMetrics.lastEventAt,
		),
		trackingQuality: {
			totalEvents: externalEvents.length,
			analyticsConsented: eventMetrics.analyticsConsented,
			analyticsBlocked: eventMetrics.analyticsBlocked,
			marketingConsented: eventMetrics.marketingConsented,
			marketingBlocked: eventMetrics.marketingBlocked,
		},
	};
}

function normalizeCapiDeliveryMode(
	mode: string | undefined | null,
): 'disabled' | 'test' | 'production' {
	const normalized = mode?.trim().toLowerCase();
	if (normalized === 'test' || normalized === 'production') return normalized;
	return 'disabled';
}

function buildKeyTrackingEvents(summary: CommercialDashboardSummary) {
	return [
		{
			label: 'Página inicial',
			count: summary.keyTrackingEventCounts.pageViewed,
			detectedHelper: 'Se registraron vistas de la página inicial.',
			missingHelper: 'Sin vistas de página inicial registradas todavía.',
		},
		{
			label: 'Demos',
			count: summary.keyTrackingEventCounts.demoViewed,
			detectedHelper: 'Se registraron vistas de demos.',
			missingHelper: 'Sin vistas de demos registradas todavía.',
		},
		{
			label: 'CTAs',
			count: summary.keyTrackingEventCounts.ctaClicked,
			detectedHelper: 'Se registraron clics en llamadas a la acción.',
			missingHelper: 'Sin clics CTA registrados todavía.',
		},
		{
			label: 'WhatsApp',
			count: summary.keyTrackingEventCounts.whatsappClicked,
			detectedHelper: 'Se registraron intenciones por WhatsApp.',
			missingHelper: 'Sin intenciones de WhatsApp registradas todavía.',
		},
	];
}

function resolveCapiStatus(
	capiMode: 'disabled' | 'test' | 'production',
	conversionCounts: Record<ConversionSummaryRow['status'], number>,
): HealthSeverity {
	if (capiMode === 'disabled') return 'safe-disabled';
	if (conversionCounts.failed > 0) return 'error';
	if (conversionCounts.pending + conversionCounts.sending > 0) return 'attention';
	return 'correct';
}

function buildCommercialWarnings(summary: CommercialDashboardSummary): CommercialHealthWarning[] {
	const warnings: CommercialHealthWarning[] = [];

	if (summary.ordersWithPendingBalance > 0) {
		warnings.push({
			label: 'Órdenes con saldo pendiente',
			count: summary.ordersWithPendingBalance,
			severity: 'attention',
			helper: 'Revisa seguimiento comercial o pago final cuando aplique.',
		});
	}
	if (summary.ordersWithInconsistentValues > 0) {
		warnings.push({
			label: 'Órdenes con valores inconsistentes',
			count: summary.ordersWithInconsistentValues,
			severity: 'error',
			helper: 'El monto pagado supera el total de la orden.',
		});
	}

	return warnings;
}

function resolveCommercialStatus(warnings: CommercialHealthWarning[]): HealthSeverity {
	if (warnings.some((warning) => warning.severity === 'error')) return 'error';
	return warnings.length > 0 ? 'attention' : 'correct';
}

function buildTrafficCards(summary: CommercialDashboardSummary): CommercialMetricCard[] {
	return [
		{ id: 'sessions', label: 'Sesiones externas', value: formatCount(summary.totals.sessions) },
		{ id: 'ctaClicks', label: 'Clics CTA', value: formatCount(summary.totals.ctaClicks) },
		{
			id: 'whatsappIntent',
			label: 'Intenciones WhatsApp',
			value: formatCount(summary.totals.whatsappClicks),
		},
		{
			id: 'formSubmissions',
			label: 'Formularios enviados',
			value: formatCount(summary.totals.formSubmissions),
		},
		{ id: 'demoViews', label: 'Demos vistas', value: formatCount(summary.totals.demoViews) },
		{ id: 'leads', label: 'Leads registrados', value: formatCount(summary.totals.leads) },
	];
}

function buildSalesCards(summary: CommercialDashboardSummary): CommercialMetricCard[] {
	return [
		{ id: 'orders', label: 'Órdenes totales', value: formatCount(summary.sales.orders) },
		{
			id: 'depositOrders',
			label: 'Órdenes con anticipo',
			value: formatCount(summary.sales.depositsPaid),
			helper: 'Cuenta órdenes con monto pagado mayor a cero.',
		},
		{
			id: 'depositRevenue',
			label: 'Ingresos por anticipos',
			value: formatCurrency(summary.sales.totalRevenue),
		},
		{
			id: 'averageDeposit',
			label: 'Anticipo promedio',
			value: formatCurrency(summary.sales.averageTicket),
			helper: 'Calculado sobre órdenes con monto pagado mayor a cero.',
			muted: true,
		},
		{
			id: 'leadOrderRatio',
			label: 'Relación general Lead → Orden',
			value: `${summary.sales.conversionLeadToOrder}%`,
			helper: 'Calculada con totales generales; todavía no es una atribución uno-a-uno.',
			muted: true,
		},
	];
}

function buildTrackingQualityCards(summary: CommercialDashboardSummary): CommercialMetricCard[] {
	return [
		{
			id: 'analyticsConsented',
			label: 'Eventos con consentimiento analítico',
			value: formatCount(summary.trackingQuality.analyticsConsented),
		},
		{
			id: 'analyticsBlocked',
			label: 'Eventos sin consentimiento analítico',
			value: formatCount(summary.trackingQuality.analyticsBlocked),
			muted: true,
		},
		{
			id: 'marketingConsented',
			label: 'Eventos con consentimiento marketing',
			value: formatCount(summary.trackingQuality.marketingConsented),
		},
		{
			id: 'marketingBlocked',
			label: 'Eventos sin consentimiento marketing',
			value: formatCount(summary.trackingQuality.marketingBlocked),
			muted: true,
		},
		{
			id: 'totalEvents',
			label: 'Eventos externos persistidos',
			value: formatCount(summary.trackingQuality.totalEvents),
		},
	];
}

export function buildCommercialDashboardViewModel(
	summary: CommercialDashboardSummary,
	options: { capiDeliveryMode?: string | null } = {},
): CommercialDashboardViewModel {
	const capiMode = normalizeCapiDeliveryMode(options.capiDeliveryMode);
	const capiModeLabel =
		capiMode === 'disabled' ? 'Desactivado' : capiMode === 'test' ? 'Prueba' : 'Producción';
	const conversionCounts = summary.conversionStatusCounts;
	const keyEvents = buildKeyTrackingEvents(summary);
	const missingKeyEvents = keyEvents.filter((event) => event.count === 0);
	const hasTracking = summary.trackingQuality.totalEvents > 0;
	const trackingStatus: HealthSeverity =
		hasTracking && missingKeyEvents.length === 0 ? 'correct' : 'attention';
	const capiStatus = resolveCapiStatus(capiMode, conversionCounts);
	const commercialWarnings = buildCommercialWarnings(summary);
	const commercialStatus = resolveCommercialStatus(commercialWarnings);

	const trafficCards = buildTrafficCards(summary);
	const salesCards = buildSalesCards(summary);

	const executiveMetrics: CommercialMetricCard[] = [
		{
			id: 'sessions',
			label: 'Sesiones externas',
			value: formatCount(summary.totals.sessions),
		},
		{
			id: 'whatsappIntent',
			label: 'Intenciones WhatsApp',
			value: formatCount(summary.totals.whatsappClicks),
		},
		{
			id: 'leads',
			label: 'Leads registrados',
			value: formatCount(summary.totals.leads),
		},
		{
			id: 'depositOrders',
			label: 'Órdenes con anticipo',
			value: formatCount(summary.sales.depositsPaid),
		},
		{
			id: 'depositRevenue',
			label: 'Ingresos por anticipos',
			value: formatCurrency(summary.sales.totalRevenue),
		},
		{
			id: 'commercialAlerts',
			label: 'Alertas comerciales',
			value: formatCount(commercialWarnings.length),
			helper:
				commercialWarnings.length > 0
					? 'Revisa la pestaña Salud del sistema para más detalles.'
					: undefined,
		},
	];

	return {
		trafficCards,
		salesCards,
		trackingQualityCards: buildTrackingQualityCards(summary),
		executiveMetrics,
		activeAlerts: commercialWarnings.length,
		health: {
			tracking: {
				status: trackingStatus,
				label:
					trackingStatus === 'correct' ? 'Tracking activo' : 'Tracking requiere atención',
				message: hasTracking
					? 'Hay eventos propios persistidos para el dashboard comercial.'
					: 'Todavía no hay eventos de tracking persistidos.',
				checks: keyEvents.map((event) => ({
					label: event.label,
					status: event.count > 0 ? 'correct' : 'attention',
					value: formatCount(event.count),
					helper: event.count > 0 ? event.detectedHelper : event.missingHelper,
				})),
			},
			capi: {
				status: capiStatus,
				label:
					capiMode === 'disabled'
						? 'Desactivado de forma segura'
						: capiStatus === 'error'
							? 'CAPI con errores'
							: 'CAPI operativo',
				message:
					capiMode === 'disabled'
						? 'CAPI desactivado de forma segura: no se envían eventos reales a Meta.'
						: capiMode === 'test'
							? 'CAPI está en modo prueba; usa eventos de test de Meta.'
							: 'CAPI está configurado en modo producción.',
				checks: [
					{ label: 'Modo actual', status: capiStatus, value: capiModeLabel },
					{
						label: 'Pendientes',
						status: conversionCounts.pending === 0 ? 'correct' : 'attention',
						value: formatCount(conversionCounts.pending),
					},
					{
						label: 'Ignorados',
						status: 'safe-disabled',
						value: formatCount(conversionCounts.skipped),
					},
					{
						label: 'Fallidos',
						status: conversionCounts.failed > 0 ? 'error' : 'correct',
						value: formatCount(conversionCounts.failed),
					},
					{
						label: 'Órdenes sin fila de conversión',
						status: summary.ordersWithDepositMissingCapi > 0 ? 'attention' : 'correct',
						value: formatCount(summary.ordersWithDepositMissingCapi),
						helper: 'Diagnóstico técnico; no forma parte de las alertas comerciales.',
					},
					{
						label: 'Enviados',
						status: 'correct',
						value: formatCount(conversionCounts.sent),
					},
					{
						label: 'Último intento',
						status: capiStatus,
						value: formatDateTime(summary.lastConversionAttemptAt),
					},
				],
			},
			commercial: {
				status: commercialStatus,
				label:
					commercialStatus === 'correct'
						? 'Datos comerciales sin alertas'
						: 'Datos comerciales con alertas',
				message:
					commercialWarnings.length === 0
						? 'No se detectaron inconsistencias básicas en órdenes y conversiones cargadas.'
						: 'Revisa las alertas antes de interpretar ingresos o conversiones.',
				warnings: commercialWarnings,
			},
		},
	};
}
