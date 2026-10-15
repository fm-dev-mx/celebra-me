/**
 * Cloudflare Web Analytics beacon (manual embed).
 *
 * The beacon is cookieless and stores nothing on the visitor's device, so it is
 * not gated by the consent banner. GA4 and the first-party tracking keep their
 * own consent and route policies.
 */

const WEB_ANALYTICS_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

export interface WebAnalyticsBeacon {
	/** Script URL; must stay allowed by any `script-src` CSP directive. */
	src: string;
	/** JSON for the `data-cf-beacon` attribute. */
	beaconConfig: string;
}

/**
 * Returns the beacon tag inputs when a site token is configured, `null` otherwise.
 * A blank token means "analytics off" (local lanes, Preview without a token).
 */
export function resolveWebAnalyticsBeacon(
	token: string | undefined | null,
): WebAnalyticsBeacon | null {
	const siteToken = token?.trim() ?? '';
	if (siteToken === '') return null;

	return {
		src: WEB_ANALYTICS_BEACON_SRC,
		beaconConfig: JSON.stringify({ token: siteToken }),
	};
}
