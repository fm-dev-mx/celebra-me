import {
	classifyServerTraffic,
	deviceClassFromRequest,
	isAutomatedUserAgent,
	isProductionEngagementEnvironment,
} from '@/lib/rsvp/engagement/traffic-classifier';

const IPHONE_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const ANDROID_TABLET =
	'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const DESKTOP_CHROME =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const INSTAGRAM_IN_APP =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; es_MX; es; scale=3.00; 1179x2556)';
const FACEBOOK_IN_APP =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]';

const PRODUCTION = { vercelEnv: 'production' };

describe('guest engagement traffic classifier', () => {
	it.each([
		['WhatsApp/2.24.20.80 A'],
		['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
		['TelegramBot (like TwitterBot)'],
		['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
		['curl/8.5.0'],
		['Mozilla/5.0 HeadlessChrome/129.0'],
		[''],
	])('treats %p as automated', (ua) => {
		expect(isAutomatedUserAgent(ua)).toBe(true);
	});

	it.each([
		[IPHONE_SAFARI],
		[ANDROID_CHROME],
		[DESKTOP_CHROME],
		[INSTAGRAM_IN_APP],
		[FACEBOOK_IN_APP],
	])('treats browsers and in-app webviews as humans: %p', (ua) => {
		expect(isAutomatedUserAgent(ua)).toBe(false);
	});

	it('classifies non-production first, then bots, then guests', () => {
		expect(classifyServerTraffic(IPHONE_SAFARI, { vercelEnv: 'preview' })).toBe(
			'non_production',
		);
		expect(classifyServerTraffic('WhatsApp/2.24.20.80 A', PRODUCTION)).toBe('bot');
		expect(classifyServerTraffic(IPHONE_SAFARI, PRODUCTION)).toBe('guest');
	});

	it('counts only Vercel Production as production', () => {
		expect(isProductionEngagementEnvironment({ vercelEnv: 'production' })).toBe(true);
		expect(isProductionEngagementEnvironment({ vercelEnv: 'preview' })).toBe(false);
		expect(isProductionEngagementEnvironment({ vercelEnv: '' })).toBe(false);
	});

	it('derives a coarse device class', () => {
		expect(deviceClassFromRequest(IPHONE_SAFARI)).toBe('mobile');
		expect(deviceClassFromRequest(ANDROID_CHROME)).toBe('mobile');
		expect(deviceClassFromRequest(ANDROID_TABLET)).toBe('tablet');
		expect(deviceClassFromRequest(DESKTOP_CHROME)).toBe('desktop');
		expect(deviceClassFromRequest('', '?1')).toBe('mobile');
		expect(deviceClassFromRequest('')).toBe('unknown');
	});
});
