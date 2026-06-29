import { summarizeCommercialAnalytics } from '@/lib/tracking/commercial-dashboard';

describe('summarizeCommercialAnalytics', () => {
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
});
