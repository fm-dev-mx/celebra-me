import { isSocialCrawler } from '@/lib/social/social-crawler';
import type { DeviceClass, ServerTrafficClass } from './taxonomy';

const AUTOMATED_USER_AGENT_PATTERN =
	/bot\b|bot\/|crawler|spider|crawling|headless|lighthouse|pingdom|uptime|monitor|python-requests|python-urllib|curl\/|wget\/|go-http-client|node-fetch|axios\/|okhttp|java\/|libwww|httpclient|scrapy|phantomjs|puppeteer|playwright/i;

/** True for crawlers, link-preview fetchers, monitors, and scripted HTTP clients. */
export function isAutomatedUserAgent(userAgent: string): boolean {
	const ua = userAgent.trim();
	if (!ua) return true;
	return isSocialCrawler(ua) || AUTOMATED_USER_AGENT_PATTERN.test(ua);
}

export interface TrafficEnvironment {
	vercelEnv: string;
}

/** Only Vercel Production counts; Local and Preview traffic is labeled non_production. */
export function isProductionEngagementEnvironment(env: TrafficEnvironment): boolean {
	return env.vercelEnv.trim().toLowerCase() === 'production';
}

/**
 * Server-side class, first match wins: non_production, bot, guest. Host and test are resolved by
 * the database from the signed-in viewer and the guest flag.
 */
export function classifyServerTraffic(
	userAgent: string,
	env: TrafficEnvironment,
): ServerTrafficClass {
	if (!isProductionEngagementEnvironment(env)) return 'non_production';
	if (isAutomatedUserAgent(userAgent)) return 'bot';
	return 'guest';
}

/** Coarse device class; the user agent itself is never stored. */
export function deviceClassFromRequest(
	userAgent: string,
	clientHintMobile?: string | null,
): DeviceClass {
	const ua = userAgent.trim();
	if (clientHintMobile === '?1') return /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
	if (!ua) return 'unknown';
	if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return 'tablet';
	if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
	if (/windows|macintosh|mac os x|linux|cros|x11/i.test(ua)) return 'desktop';
	return 'unknown';
}
