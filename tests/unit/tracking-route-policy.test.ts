import {
	DEFAULT_SPEED_INSIGHTS_SAMPLE_RATE,
	classifyTrackingRoute,
	isProductionAnalyticsEnvironment,
	resolveSpeedInsightsConfig,
	shouldLoadGoogleAnalytics,
} from '@/lib/tracking/route-policy';

describe('tracking route policy', () => {
	it.each([
		['/', 'commercial'],
		['/privacidad', 'commercial'],
		['/terminos', 'commercial'],
		['/demos/xv', 'commercial'],
		['/demos/boda', 'commercial'],
		['/demos/bautizo', 'commercial'],
		['/demos/baby-shower', 'commercial'],
		['/demos/cumpleanos', 'commercial'],
		['/xv/demo-xv-editorial', 'demo'],
		['/xv/valentina-hernandez', 'real_invitation'],
		['/xv/valentina-hernandez?invite=abc', 'personalized_invitation'],
		['/i/abc123', 'personalized_invitation'],
		['/xv/valentina-hernandez/i/abc123', 'personalized_invitation'],
		['/api/invitacion/abc/view', 'rsvp_guest_api'],
		['/api/invitacion/abc/rsvp', 'rsvp_guest_api'],
		['/dashboard', 'dashboard_admin_auth'],
		['/dashboard/invitaciones', 'dashboard_admin_auth'],
		['/api/dashboard/invitaciones', 'dashboard_admin_auth'],
		['/login', 'dashboard_admin_auth'],
		['/api/contact', 'generic_api'],
		['/desconocido', 'unknown'],
	] as const)('classifies %s as %s', (input, expected) => {
		expect(classifyTrackingRoute(input).routeClass).toBe(expected);
	});

	it.each([
		['development', false],
		['preview', false],
		['production', true],
		[undefined, false],
	] as const)('resolves production analytics environment for %s', (vercelEnv, expected) => {
		expect(isProductionAnalyticsEnvironment({ vercelEnv })).toBe(expected);
	});

	it('allows GA only for commercial or demo routes in production with an id', () => {
		const env = { vercelEnv: 'production', gaId: 'G-TEST' };

		expect(shouldLoadGoogleAnalytics('/', env)).toBe(true);
		expect(shouldLoadGoogleAnalytics('/demos/cumpleanos', env)).toBe(true);
		expect(shouldLoadGoogleAnalytics('/xv/demo-xv-editorial', env)).toBe(true);
		expect(shouldLoadGoogleAnalytics('/xv/valentina-hernandez', env)).toBe(false);
		expect(shouldLoadGoogleAnalytics('/xv/valentina-hernandez?invite=abc', env)).toBe(false);
		expect(shouldLoadGoogleAnalytics('/dashboard/invitaciones', env)).toBe(false);
		expect(shouldLoadGoogleAnalytics('/api/contact', env)).toBe(false);
	});

	it('allows Meta attribution capture only on commercial acquisition routes', () => {
		expect(classifyTrackingRoute('/').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/demos/cumpleanos').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/demo-xv-editorial').metaAllowed).toBe(true);
		expect(classifyTrackingRoute('/xv/valentina-hernandez').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/xv/valentina-hernandez?invite=abc').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/api/invitacion/abc/rsvp').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/dashboard/commercial').metaAllowed).toBe(false);
		expect(classifyTrackingRoute('/api/contact').metaAllowed).toBe(false);
	});

	it('does not allow GA in preview, local development, or without a measurement id', () => {
		expect(shouldLoadGoogleAnalytics('/', { vercelEnv: 'preview', gaId: 'G-TEST' })).toBe(
			false,
		);
		expect(shouldLoadGoogleAnalytics('/', { vercelEnv: 'development', gaId: 'G-TEST' })).toBe(
			false,
		);
		expect(shouldLoadGoogleAnalytics('/', { vercelEnv: 'production', gaId: '' })).toBe(false);
	});

	describe('resolveSpeedInsightsConfig', () => {
		it('enables Speed Insights with default sampleRate in production on public and invitation routes', () => {
			const env = { vercelEnv: 'production' };

			expect(resolveSpeedInsightsConfig('/', env)).toEqual({
				enabled: true,
				sampleRate: DEFAULT_SPEED_INSIGHTS_SAMPLE_RATE,
			});
			expect(resolveSpeedInsightsConfig('/demos/xv', env)).toEqual({
				enabled: true,
				sampleRate: DEFAULT_SPEED_INSIGHTS_SAMPLE_RATE,
			});
			expect(resolveSpeedInsightsConfig('/xv/valentina-hernandez', env)).toEqual({
				enabled: true,
				sampleRate: DEFAULT_SPEED_INSIGHTS_SAMPLE_RATE,
			});
			expect(resolveSpeedInsightsConfig('/xv/valentina-hernandez?invite=abc', env)).toEqual({
				enabled: true,
				sampleRate: DEFAULT_SPEED_INSIGHTS_SAMPLE_RATE,
			});
		});

		it('disables Speed Insights on dashboard, auth, and API routes', () => {
			const env = { vercelEnv: 'production' };

			expect(resolveSpeedInsightsConfig('/login', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/dashboard', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/dashboard/invitaciones', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/dashboard/invitaciones/123/preview', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/api/dashboard/invitaciones', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/api/invitacion/abc/rsvp', env)).toEqual({
				enabled: false,
				sampleRate: 0,
			});
		});

		it('disables Speed Insights in non-production environments', () => {
			expect(resolveSpeedInsightsConfig('/', { vercelEnv: 'preview' })).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/', { vercelEnv: 'development' })).toEqual({
				enabled: false,
				sampleRate: 0,
			});
			expect(resolveSpeedInsightsConfig('/', {})).toEqual({
				enabled: false,
				sampleRate: 0,
			});
		});
	});
});
