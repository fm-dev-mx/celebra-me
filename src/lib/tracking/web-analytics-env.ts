/**
 * Environment resolver for the Cloudflare Web Analytics beacon.
 * Isolates import.meta.env references to prevent syntax errors in Jest CJS runtime.
 */

export function getWebAnalyticsToken(): string {
	return import.meta.env.PUBLIC_CF_WEB_ANALYTICS_TOKEN || '';
}
