import {
	COOKIE_NAME_IGNORE_TRACKING,
	shouldExcludeInternalTraffic,
} from '@/lib/tracking/internal-exclusion';
import { normalizeConsentSnapshot } from '@/lib/tracking/consent-policy';
import {
	TrackingEventSchema,
	hasUnsafeEventProperties,
	sanitizeEventProperties,
} from '@/lib/tracking/event-contract';

describe('internal traffic exclusion', () => {
	it('excludes dashboard-authenticated users, opt-out cookies, and preview/local environments', () => {
		expect(
			shouldExcludeInternalTraffic({
				isDashboardAuthenticated: true,
				routeClass: 'commercial',
				vercelEnv: 'production',
			}).exclude,
		).toBe(true);

		expect(
			shouldExcludeInternalTraffic({
				cookieHeader: `${COOKIE_NAME_IGNORE_TRACKING}=true`,
				routeClass: 'commercial',
				vercelEnv: 'production',
			}).exclude,
		).toBe(true);

		expect(
			shouldExcludeInternalTraffic({ routeClass: 'commercial', vercelEnv: 'preview' })
				.exclude,
		).toBe(true);

		expect(
			shouldExcludeInternalTraffic({ routeClass: 'commercial', vercelEnv: 'production' })
				.exclude,
		).toBe(false);
	});
});

describe('consent policy', () => {
	it('defaults to necessary consent only', () => {
		expect(normalizeConsentSnapshot(undefined)).toEqual({
			necessary: true,
			analytics: false,
			marketing: false,
		});
	});

	it('normalizes explicit analytics and marketing consent', () => {
		expect(
			normalizeConsentSnapshot({ analytics: true, marketing: true, necessary: false }),
		).toEqual({
			necessary: true,
			analytics: true,
			marketing: true,
		});
	});
});

describe('tracking event contract', () => {
	it('accepts PII-safe event properties and strips unsupported values', () => {
		const properties = sanitizeEventProperties({
			cta_id: 'hero_whatsapp',
			depth_bucket: 75,
			success: true,
			ignored: { nested: true },
		});

		expect(properties).toEqual({
			cta_id: 'hero_whatsapp',
			depth_bucket: 75,
			success: true,
		});
	});

	it('detects unsafe PII-like event properties', () => {
		expect(hasUnsafeEventProperties({ email: 'client@example.com' })).toBe(true);
		expect(hasUnsafeEventProperties({ phone: '5215555555555' })).toBe(true);
		expect(hasUnsafeEventProperties({ cta_id: 'pricing_collection' })).toBe(false);
	});

	it('validates first-party tracking event payloads', () => {
		const result = TrackingEventSchema.safeParse({
			sessionId: '11111111-1111-4111-8111-111111111111',
			visitorId: 'visitor_123456',
			eventName: 'cta_clicked',
			routePath: '/',
			routeClass: 'commercial',
			eventProperties: { cta_id: 'hero_whatsapp' },
			consentSnapshot: { necessary: true, analytics: true, marketing: false },
		});

		expect(result.success).toBe(true);
	});
});
