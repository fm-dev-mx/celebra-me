import fs from 'node:fs';
import path from 'node:path';
import { resolveWebAnalyticsBeacon } from '@/lib/tracking/web-analytics';
import {
	INVITATION_PREVIEW_SECURITY_HEADERS,
	SECURITY_HEADERS,
} from '@/lib/server/security-headers';

const projectRoot = process.cwd();

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

const BEACON_HOST = 'static.cloudflareinsights.com';
const BEACON_ENDPOINT_HOST = 'cloudflareinsights.com';

describe('Cloudflare Web Analytics beacon', () => {
	describe('resolveWebAnalyticsBeacon', () => {
		it.each([undefined, null, '', '   '])('stays off without a site token (%p)', (token) => {
			expect(resolveWebAnalyticsBeacon(token)).toBeNull();
		});

		it('builds the manual-embed tag inputs from the site token', () => {
			const beacon = resolveWebAnalyticsBeacon(' abc123 ');

			expect(beacon).not.toBeNull();
			expect(beacon?.src).toBe(`https://${BEACON_HOST}/beacon.min.js`);
			expect(JSON.parse(beacon?.beaconConfig ?? '')).toEqual({ token: 'abc123' });
		});
	});

	describe('Layout.astro', () => {
		const layout = read('src/layouts/Layout.astro');

		it('no longer loads Vercel Analytics or Speed Insights', () => {
			expect(layout).not.toContain('@vercel/analytics');
			expect(layout).not.toContain('@vercel/speed-insights');
			expect(layout).not.toContain('<Analytics');
			expect(layout).not.toContain('<SpeedInsights');
			expect(layout).not.toContain('resolveSpeedInsightsConfig');
		});

		it('renders the beacon only when the token resolves, outside the consent gate', () => {
			expect(layout).toContain(
				"import { resolveWebAnalyticsBeacon } from '@/lib/tracking/web-analytics';",
			);
			expect(layout).toContain(
				"import { getWebAnalyticsToken } from '@/lib/tracking/web-analytics-env';",
			);
			expect(layout).toContain(
				'const webAnalyticsBeacon = resolveWebAnalyticsBeacon(getWebAnalyticsToken());',
			);
			expect(layout).toMatch(
				/webAnalyticsBeacon && \(\s*<script\s+is:inline\s+type="module"\s+src=\{webAnalyticsBeacon\.src\}\s+data-cf-beacon=\{webAnalyticsBeacon\.beaconConfig\}\s*\/>/,
			);
			// The commercial gate still wraps only GA4 / first-party tracking.
			expect(layout).not.toMatch(/loadCommercialTracking && \(\s*<script\s+is:inline/);
			expect(layout).toContain('{loadCommercialTracking && (');
			expect(layout).toContain('initCommercialTracking();');
		});
	});

	describe('Vercel dependencies', () => {
		it('are gone from package.json', () => {
			const pkg = JSON.parse(read('package.json')) as {
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

			expect(names).not.toContain('@vercel/analytics');
			expect(names).not.toContain('@vercel/speed-insights');
		});
	});

	describe('Content-Security-Policy served by the middleware', () => {
		const cspValues = [...SECURITY_HEADERS, ...INVITATION_PREVIEW_SECURITY_HEADERS]
			.filter(([name]) => name.toLowerCase() === 'content-security-policy')
			.map(([, value]) => value);

		it('keeps the beacon allowed wherever scripts or connections are restricted', () => {
			expect(cspValues.length).toBeGreaterThan(0);
			for (const value of cspValues) {
				const directives = new Map(
					value
						.split(';')
						.map((part) => part.trim())
						.filter(Boolean)
						.map((part) => {
							const [name, ...sources] = part.split(/\s+/);
							return [name, sources] as const;
						}),
				);
				const scriptSrc = directives.get('script-src') ?? directives.get('script-src-elem');
				const connectSrc = directives.get('connect-src');
				const defaultSrc = directives.get('default-src');

				if (scriptSrc) expect(scriptSrc.join(' ')).toContain(BEACON_HOST);
				if (connectSrc) expect(connectSrc.join(' ')).toContain(BEACON_ENDPOINT_HOST);
				if (defaultSrc && !scriptSrc) expect(defaultSrc.join(' ')).toContain(BEACON_HOST);
				if (defaultSrc && !connectSrc) {
					expect(defaultSrc.join(' ')).toContain(BEACON_ENDPOINT_HOST);
				}
			}
		});

		it('never allows the retired Vercel telemetry hosts', () => {
			for (const value of cspValues) {
				expect(value).not.toContain('vercel-scripts.com');
				expect(value).not.toContain('vercel-insights.com');
			}
		});
	});
});
