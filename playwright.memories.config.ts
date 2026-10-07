import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Guest memories flow across the browser engines and screen sizes guests bring.
 * Reuses the web server of `playwright.config.ts`; only the memories specs run.
 *
 * The two in-app projects send the user agent of an embedded browser on the
 * engine that browser uses. They guard against user-agent-dependent code; they
 * do not reproduce the real WebView (see the phone rehearsal checklist in
 * workers/celebra-memories-sign/OWNER.md).
 */

const INSTAGRAM_IOS_USER_AGENT =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.0 (iPhone14,7; iOS 17_5; es_MX; es; scale=3.00; 1170x2532)';
const FACEBOOK_ANDROID_USER_AGENT =
	'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]';

const guestLocale = { locale: 'es-MX', timezoneId: 'America/Mazatlan' };

export default defineConfig({
	...baseConfig,
	globalSetup: undefined,
	globalTeardown: undefined,
	testMatch: ['memories-*.spec.ts'],
	reporter: [['list']],
	projects: [
		{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], ...guestLocale } },
		{ name: 'android-chrome', use: { ...devices['Pixel 7'], ...guestLocale } },
		{ name: 'ios-safari', use: { ...devices['iPhone 14'], ...guestLocale } },
		{
			name: 'ios-instagram-webview',
			use: { ...devices['iPhone 14'], ...guestLocale, userAgent: INSTAGRAM_IOS_USER_AGENT },
		},
		{
			name: 'android-facebook-webview',
			use: { ...devices['Pixel 7'], ...guestLocale, userAgent: FACEBOOK_ANDROID_USER_AGENT },
		},
	],
});
