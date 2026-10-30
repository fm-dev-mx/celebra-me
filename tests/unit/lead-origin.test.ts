import {
	buildLeadOrigin,
	leadOriginWindowStart,
	normalizeLeadCode,
	type LeadOriginEventRow,
	type LeadOriginInput,
	type LeadOriginSessionRow,
} from '@/lib/tracking/lead-origin';

const CLICK_AT = '2026-10-27T18:00:00.000Z';

const session = (
	id: string,
	overrides: Partial<LeadOriginSessionRow> = {},
): LeadOriginSessionRow => ({
	id,
	visitor_id: 'visitor-1',
	started_at: '2026-10-27T17:30:00.000Z',
	landing_path: '/',
	referrer: null,
	utm_source: null,
	utm_medium: null,
	utm_campaign: null,
	fbclid: null,
	fbc: null,
	device_type: 'mobile',
	is_internal: false,
	...overrides,
});

const event = (
	id: string,
	name: string,
	sessionId: string,
	properties: Record<string, unknown> = {},
	overrides: Partial<LeadOriginEventRow> = {},
): LeadOriginEventRow => ({
	id,
	session_id: sessionId,
	visitor_id: 'visitor-1',
	event_name: name,
	occurred_at: '2026-10-27T17:45:00.000Z',
	route_path: '/editorial',
	event_properties: properties,
	is_internal: false,
	...overrides,
});

const click = event(
	'click',
	'whatsapp_contact_clicked',
	'own',
	{ cta_label: 'Quiero esta', cta_location: 'promo-strip', promo_code: 'PROMO-CODE' },
	{ occurred_at: CLICK_AT, route_path: '/' },
);

const input = (overrides: Partial<LeadOriginInput> = {}): LeadOriginInput => ({
	lead: {
		id: 'lead-1',
		lead_code: 'CM-PPMZNN',
		session_id: 'own',
		source_event_id: 'click',
		created_at: '2026-10-27T18:00:05.000Z',
	},
	click,
	leadSession: session('own', { utm_source: 'facebook', utm_campaign: 'octubre', fbclid: 'abc' }),
	visitorSessions: [],
	events: [],
	followups: [],
	demoTitles: new Map([['demo-editorial', 'Editorial']]),
	...overrides,
});

describe('lead origin', () => {
	it('normalizes folio queries and rejects anything else', () => {
		expect(normalizeLeadCode(' cm-ppmznn ')).toBe('CM-PPMZNN');
		expect(normalizeLeadCode('CM-123')).toBeNull();
		expect(normalizeLeadCode("CM-ABCDEF'")).toBeNull();
		expect(normalizeLeadCode(null)).toBeNull();
	});

	it('reports the click and arrival from the lead session', () => {
		const origin = buildLeadOrigin(input());
		expect(origin.hasNavigation).toBe(true);
		expect(origin.click).toMatchObject({
			label: 'Quiero esta',
			section: 'promo-strip',
			page: '/',
			promoCode: 'PROMO-CODE',
			at: CLICK_AT,
		});
		expect(origin.arrival).toMatchObject({
			landingPath: '/',
			utm: 'facebook / octubre',
			metaAd: true,
			device: 'mobile',
		});
		expect(origin.contactAt).toBe(CLICK_AT);
		expect(origin.visits).toBe(1);
	});

	it('counts demo views with max depth per page and flags demos from another tab', () => {
		const origin = buildLeadOrigin(
			input({
				visitorSessions: [session('other-tab', { started_at: '2026-10-20T10:00:00.000Z' })],
				events: [
					event('1', 'demo_viewed', 'own', { demo_slug: 'demo-editorial' }),
					event(
						'2',
						'demo_viewed',
						'own',
						{ demo_slug: 'demo-editorial' },
						{
							occurred_at: '2026-10-27T17:50:00.000Z',
						},
					),
					event('3', 'scroll_depth_reached', 'own', { depth_bucket: 50 }),
					event('4', 'scroll_depth_reached', 'own', { depth_bucket: 75 }),
					event(
						'5',
						'scroll_depth_reached',
						'own',
						{ depth_bucket: 100 },
						{ route_path: '/' },
					),
					event(
						'6',
						'demo_viewed',
						'other-tab',
						{ demo_slug: 'demo-jardin' },
						{
							route_path: '/jardin',
						},
					),
					event('7', 'package_viewed', 'own', {
						package_id: 'premium',
						package_name: 'Premium',
					}),
				],
			}),
		);
		expect(origin.demos).toEqual([
			{
				slug: 'demo-editorial',
				title: 'Editorial',
				views: 2,
				maxDepth: 75,
				lastSeenAt: '2026-10-27T17:50:00.000Z',
				otherLinkOnly: false,
			},
			expect.objectContaining({
				slug: 'demo-jardin',
				title: 'demo-jardin',
				otherLinkOnly: true,
				maxDepth: null,
			}),
		]);
		expect(origin.packages).toEqual([{ id: 'premium', name: 'Premium', views: 1 }]);
		expect(origin.visits).toBe(2);
		expect(origin.firstVisitAt).toBe('2026-10-20T10:00:00.000Z');
	});

	it('hides internal traffic and sessions outside the visitor window', () => {
		const tooOld = new Date(Date.parse(leadOriginWindowStart(CLICK_AT)) - 1).toISOString();
		const origin = buildLeadOrigin(
			input({
				visitorSessions: [
					session('internal', { is_internal: true }),
					session('old', { started_at: tooOld }),
					session('after', { started_at: '2026-10-28T00:00:00.000Z' }),
				],
				events: [
					event('1', 'demo_viewed', 'internal', { demo_slug: 'demo-a' }),
					event('2', 'demo_viewed', 'old', { demo_slug: 'demo-b' }),
					event('3', 'demo_viewed', 'after', { demo_slug: 'demo-c' }),
					event(
						'4',
						'demo_viewed',
						'own',
						{ demo_slug: 'demo-d' },
						{ is_internal: true },
					),
				],
			}),
		);
		expect(origin.demos).toEqual([]);
		expect(origin.visits).toBe(1);
	});

	it('says there is no navigation data instead of rendering an empty origin', () => {
		const origin = buildLeadOrigin(
			input({
				lead: { ...input().lead, session_id: null, source_event_id: null },
				click: null,
				leadSession: null,
			}),
		);
		expect(origin.hasNavigation).toBe(false);
		expect(origin.click).toBeNull();
		expect(origin.arrival).toBeNull();
		expect(origin.contactAt).toBe('2026-10-27T18:00:05.000Z');
	});

	it('treats an internal lead session as no navigation data', () => {
		const origin = buildLeadOrigin(
			input({
				click: { ...click, is_internal: true },
				leadSession: session('own', { is_internal: true }),
			}),
		);
		expect(origin.hasNavigation).toBe(false);
	});

	it('lists demos the operator shared and keeps a failed read unknown', () => {
		const shared = buildLeadOrigin(
			input({
				followups: [
					{
						demo_slug: 'demo-editorial',
						action: 'demo_shared',
						occurred_at: '2026-10-28T10:00:00Z',
					},
					{
						demo_slug: 'demo-editorial',
						action: 'quote_sent',
						occurred_at: '2026-10-28T11:00:00Z',
					},
				],
			}),
		);
		expect(shared.sharedDemos).toEqual([
			{ slug: 'demo-editorial', title: 'Editorial', at: '2026-10-28T10:00:00Z' },
		]);
		expect(buildLeadOrigin(input({ followups: null })).sharedDemos).toBeNull();
	});
});
