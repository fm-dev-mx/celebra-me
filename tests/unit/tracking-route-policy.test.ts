import { classifyTrackingRoute } from '@/lib/tracking/route-policy';

describe('tracking route policy', () => {
	it.each([
		['/', 'commercial'],
		['/privacidad', 'commercial'],
		['/terminos', 'commercial'],
		['/demos/xv', 'commercial'],
		['/demos/boda', 'commercial'],
		['/demos/bautizo', 'commercial'],
		['/demos/cumpleanos', 'commercial'],
		['/xv/demo-xv-editorial', 'demo'],
		['/xv/valentina-hernandez', 'real_invitation'],
		['/xv/valentina-hernandez?invite=abc', 'personalized_invitation'],
		['/i/abc123', 'personalized_invitation'],
		['/xv/valentina-hernandez/i/abc123', 'personalized_invitation'],
		['/api/invitacion/abc/events', 'rsvp_guest_api'],
		['/api/invitacion/abc/rsvp', 'rsvp_guest_api'],
		['/dashboard', 'dashboard_admin_auth'],
		['/dashboard/invitaciones', 'dashboard_admin_auth'],
		['/api/dashboard/invitaciones', 'dashboard_admin_auth'],
		['/login', 'dashboard_admin_auth'],
		['/api/health', 'generic_api'],
		['/america', 'real_invitation'],
		['/xv', 'unknown'],
		['/a/b/c', 'unknown'],
	] as const)('classifies %s as %s', (input, expected) => {
		expect(classifyTrackingRoute(input).routeClass).toBe(expected);
	});

	it('allows Meta attribution capture only on commercial acquisition routes', () => {
		expect(classifyTrackingRoute('/').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/demos/cumpleanos').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/demo-xv-editorial').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/valentina-hernandez').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/xv/valentina-hernandez?invite=abc').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/api/invitacion/abc/rsvp').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/dashboard/commercial').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/api/health').metaAllowed).toBe(false);
	});

	it('allows GA only on commercial and demo routes', () => {
		expect(classifyTrackingRoute('/').gaAllowed).toBe(true);
		expect(classifyTrackingRoute('/demos/cumpleanos').gaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/demo-xv-editorial').gaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/valentina-hernandez').gaAllowed).toBe(false);
		expect(classifyTrackingRoute('/xv/valentina-hernandez?invite=abc').gaAllowed).toBe(false);
		expect(classifyTrackingRoute('/dashboard/invitaciones').gaAllowed).toBe(false);
		expect(classifyTrackingRoute('/api/health').gaAllowed).toBe(false);
	});
});
