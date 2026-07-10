import {
	buildCommercialDashboardViewModel,
	summarizeCommercialAnalytics,
} from '@/lib/tracking/commercial-dashboard';
import { presentCommercialAttribution } from '@/lib/tracking/commercial-presentation';

describe('summarizeCommercialAnalytics', () => {
	it('separates technical attribution and translates raw commercial labels', () => {
		const presentation = presentCommercialAttribution([
			{ label: 'hero_secondary', count: 4 },
			{ label: 'event-types', count: 3 },
			{ label: 'instagram / paid_social / xv-primavera', count: 2 },
			{ label: 'qa_internal / debug / commercial_dashboard_health', count: 2 },
			{ label: 'QA test data', count: 899 },
		]);

		expect(presentation.commercial).toEqual([
			{ label: 'Portada · Acción secundaria', count: 4 },
			{ label: 'Tipos de evento', count: 3 },
			{
				label: 'Instagram · Publicidad pagada · Redes sociales · XV años · Primavera',
				count: 2,
			},
		]);
		expect(presentation.technical).toEqual([
			{ label: 'Datos internos / QA (no comerciales)', count: 901 },
		]);
		expect(presentation.commercial).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: expect.stringContaining('QA') }),
			]),
		);
	});
	it('summarizes sessions, engagement, CTAs, demos, campaigns, and leads', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [
				{
					id: 's1',
					route_class: 'commercial',
					is_internal: false,
					source: 'instagram',
					medium: 'paid',
					campaign: 'summer',
				},
				{
					id: 's2',
					route_class: 'demo',
					is_internal: false,
					source: 'google',
					medium: 'organic',
					campaign: '',
				},
				{
					id: 's3',
					route_class: 'commercial',
					is_internal: true,
					source: '',
					medium: '',
					campaign: '',
				},
			],
			events: [
				{
					event_name: 'cta_clicked',
					event_properties: { cta_id: 'hero_whatsapp' },
					source: 'instagram',
					medium: 'paid',
					campaign: 'summer',
				},
				{
					event_name: 'whatsapp_contact_clicked',
					event_properties: { cta_id: 'hero_whatsapp' },
					source: 'instagram',
					medium: 'paid',
					campaign: 'summer',
				},
				{
					event_name: 'demo_viewed',
					event_properties: { demo_slug: 'demo-xv-editorial' },
					source: '',
					medium: '',
					campaign: '',
				},
				{
					event_name: 'scroll_depth_reached',
					event_properties: { depth_bucket: 75 },
					source: '',
					medium: '',
					campaign: '',
				},
				{
					event_name: 'section_seen',
					event_properties: { section_id: 'pricing' },
					source: '',
					medium: '',
					campaign: '',
				},
			],
			leads: [
				{
					status: 'new',
					channel: 'contact_form',
					utm_source: 'instagram',
					utm_medium: 'paid',
					utm_campaign: 'summer',
				},
			],
			orders: [],
		});

		expect(summary.totals.sessions).toBe(2);
		expect(summary.totals.internalSessions).toBe(1);
		expect(summary.totals.ctaClicks).toBe(1);
		expect(summary.totals.whatsappClicks).toBe(1);
		expect(summary.totals.demoViews).toBe(1);
		expect(summary.totals.leads).toBe(1);
		expect(summary.topCtas[0]).toEqual({ label: 'hero_whatsapp', count: 2 });
		expect(summary.topDemos[0]).toEqual({ label: 'demo-xv-editorial', count: 1 });
		expect(summary.scrollDepth[0]).toEqual({ label: '75%', count: 1 });
		expect(summary.sections[0]).toEqual({ label: 'pricing', count: 1 });
		expect(summary.campaigns[0]).toEqual({
			label: 'instagram / paid / summer',
			count: 4,
		});
		expect(summary.leadsByStatus[0]).toEqual({ label: 'Nuevo', count: 1 });
		expect(summary.leadsByChannel[0]).toEqual({ label: 'Formulario', count: 1 });
	});

	it('returns zero-based sales summary when no orders exist', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [],
			events: [],
			leads: [],
			orders: [],
		});

		expect(summary.sales.orders).toBe(0);
		expect(summary.sales.depositsPaid).toBe(0);
		expect(summary.sales.totalRevenue).toBe(0);
		expect(summary.sales.averageTicket).toBe(0);
		expect(summary.sales.conversionLeadToOrder).toBe(0);
		expect(summary.ordersByStatus).toEqual([]);
		expect(summary.topRevenueByEventType).toEqual([]);
	});

	it('builds honest sales labels and helper text for weak attribution metrics', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [],
			events: [],
			leads: [
				{
					status: 'new',
					channel: 'contact_form',
				},
				{
					status: 'new',
					channel: 'whatsapp',
				},
			],
			orders: [
				{
					id: 'order-1',
					status: 'deposit_paid',
					total_amount: 1800,
					amount_paid: 899,
					event_type: 'xv',
					package_name: 'Premium',
					created_at: '2026-07-09T10:00:00.000Z',
					deposit_paid_at: '2026-07-09T11:00:00.000Z',
				},
			],
		});

		const viewModel = buildCommercialDashboardViewModel(summary, {
			capiDeliveryMode: 'disabled',
		});

		expect(viewModel.salesCards).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'depositOrders', label: 'Órdenes con anticipo' }),
				expect.objectContaining({ id: 'depositRevenue', label: 'Ingresos por anticipos' }),
				expect.objectContaining({
					id: 'averageDeposit',
					label: 'Anticipo promedio',
					helper: 'Calculado sobre órdenes con monto pagado mayor a cero.',
				}),
				expect.objectContaining({
					id: 'leadOrderRatio',
					label: 'Relación general Lead → Orden',
					helper: 'Calculada con totales generales; todavía no es una atribución uno-a-uno.',
				}),
			]),
		);
	});

	it('surfaces data scope, freshness, and query-limit transparency', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [
				{
					id: 'session-1',
					route_class: 'commercial',
					is_internal: false,
					source: 'qa',
					medium: 'manual',
					campaign: 'health',
					last_seen_at: '2026-07-09T12:00:00.000Z',
				},
			],
			events: [
				{
					event_name: 'page_viewed',
					event_properties: {},
					occurred_at: '2026-07-09T12:01:00.000Z',
				},
			],
			leads: [
				{
					status: 'new',
					channel: 'contact_form',
					created_at: '2026-07-09T12:02:00.000Z',
				},
			],
			orders: [
				{
					id: 'order-1',
					status: 'confirmed',
					total_amount: 1800,
					amount_paid: 0,
					created_at: '2026-07-09T12:03:00.000Z',
				},
			],
			conversions: [
				{
					id: 'conversion-1',
					order_id: 'order-1',
					status: 'pending',
					created_at: '2026-07-09T12:04:00.000Z',
					updated_at: '2026-07-09T12:05:00.000Z',
				},
			],
		});

		expect(summary.dataContext.periodLabel).toBe('Mostrando datos históricos disponibles');
		expect(summary.dataContext.scopeLabel).toBe('Sin filtro de fechas activo');
		expect(summary.dataContext.lastTrackingEventAt).toBe('2026-07-09T12:01:00.000Z');
		expect(summary.dataContext.lastCommercialUpdateAt).toBe('2026-07-09T12:05:00.000Z');
		expect(summary.dataContext.limitNotice).toContain('últimos registros cargados');
	});

	it('summarizes tracking, disabled CAPI, and commercial data warnings', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [],
			events: [
				{
					event_name: 'page_viewed',
					event_properties: {},
					occurred_at: '2026-07-09T12:01:00.000Z',
				},
				{
					event_name: 'cta_clicked',
					event_properties: { cta_id: 'hero' },
					occurred_at: '2026-07-09T12:02:00.000Z',
				},
			],
			leads: [],
			orders: [
				{
					id: 'order-without-capi',
					status: 'deposit_paid',
					total_amount: 1800,
					amount_paid: 899,
					created_at: '2026-07-09T12:03:00.000Z',
					deposit_paid_at: '2026-07-09T12:04:00.000Z',
				},
				{
					id: 'order-overpaid',
					status: 'deposit_paid',
					total_amount: 500,
					amount_paid: 700,
					created_at: '2026-07-09T12:03:00.000Z',
				},
			],
			conversions: [
				{
					id: 'conversion-1',
					order_id: 'different-order',
					status: 'skipped',
					created_at: '2026-07-09T12:05:00.000Z',
					updated_at: '2026-07-09T12:06:00.000Z',
				},
			],
		});

		const viewModel = buildCommercialDashboardViewModel(summary, {
			capiDeliveryMode: 'disabled',
		});

		// Executive metrics for Resumen tab
		expect(viewModel.executiveMetrics).toHaveLength(6);
		expect(viewModel.executiveMetrics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'sessions', label: 'Sesiones externas' }),
				expect.objectContaining({ id: 'commercialAlerts', label: 'Alertas comerciales' }),
			]),
		);
		expect(viewModel.activeAlerts).toBeGreaterThan(0);

		expect(viewModel.health.tracking.status).toBe('attention');
		expect(viewModel.health.tracking.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: 'WhatsApp', status: 'attention' }),
				expect.objectContaining({ label: 'Demos', status: 'attention' }),
			]),
		);
		expect(viewModel.health.capi.status).toBe('safe-disabled');
		expect(viewModel.health.capi.message).toBe(
			'CAPI desactivado de forma segura: no se envían eventos reales a Meta.',
		);
		expect(summary.lastConversionAttemptAt).toBe('2026-07-09T12:06:00.000Z');
		expect(viewModel.health.capi.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Último intento',
					status: 'safe-disabled',
				}),
			]),
		);
		expect(viewModel.health.commercial.warnings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Órdenes con valores inconsistentes',
					count: 1,
				}),
			]),
		);
		expect(viewModel.health.commercial.warnings).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: expect.stringContaining('CAPI') }),
			]),
		);
		expect(viewModel.health.capi.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Órdenes sin fila de conversión',
					value: '2',
				}),
			]),
		);
	});

	it('uses key tracking events instead of session count for tracking health checks', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [
				{
					id: 'session-without-page-event',
					route_class: 'commercial',
					is_internal: false,
				},
			],
			events: [
				{
					event_name: 'cta_clicked',
					event_properties: { cta_id: 'hero' },
				},
			],
			leads: [],
		});

		const viewModel = buildCommercialDashboardViewModel(summary);

		expect(viewModel.health.tracking.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Página inicial',
					status: 'attention',
					value: '0',
				}),
				expect.objectContaining({
					label: 'CTAs',
					status: 'correct',
					value: '1',
				}),
			]),
		);
	});

	it('keeps tracking health helper text operator-friendly', () => {
		const summary = summarizeCommercialAnalytics({
			sessions: [],
			events: [
				{
					event_name: 'page_viewed',
					event_properties: {},
				},
			],
			leads: [],
		});

		const viewModel = buildCommercialDashboardViewModel(summary);
		const helperText = viewModel.health.tracking.checks
			.map((check) => check.helper ?? '')
			.join(' ');

		expect(helperText).not.toContain('page_viewed');
		expect(helperText).not.toContain('demo_viewed');
		expect(helperText).not.toContain('cta_clicked');
		expect(helperText).toContain('Se registraron vistas de la página inicial.');
	});
});
