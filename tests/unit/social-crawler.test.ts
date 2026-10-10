import { isSocialCrawler, socialCrawlerFamily } from '@/lib/social/social-crawler';

describe('isSocialCrawler', () => {
	it('returns true for WhatsApp user agent', () => {
		expect(isSocialCrawler('WhatsApp/2.24.10.81 iOS')).toBe(true);
	});

	it('returns true for WhatsApp text in user agent', () => {
		expect(isSocialCrawler('Mozilla/5.0 WhatsApp/1.0')).toBe(true);
	});

	it('returns true for facebookexternalhit', () => {
		expect(isSocialCrawler('facebookexternalhit/1.1')).toBe(true);
	});

	it('returns true for Facebot', () => {
		expect(isSocialCrawler('Facebot')).toBe(true);
	});

	it('returns true for Twitterbot', () => {
		expect(isSocialCrawler('Twitterbot/1.0')).toBe(true);
	});

	it('returns true for LinkedInBot', () => {
		expect(isSocialCrawler('LinkedInBot/1.0 (compatible; Mozilla/5.0)')).toBe(true);
	});

	it('returns true for Slackbot', () => {
		expect(isSocialCrawler('Slackbot-LinkExpanding 1.0')).toBe(true);
	});

	it('returns true for Discordbot', () => {
		expect(isSocialCrawler('Discordbot/2.0 (+https://discordapp.com)')).toBe(true);
	});

	it('returns true for TelegramBot', () => {
		expect(isSocialCrawler('TelegramBot (like TwitterBot)')).toBe(true);
	});

	it('returns false for normal browser user agents', () => {
		expect(isSocialCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(
			false,
		);
	});

	it('returns false for Googlebot', () => {
		expect(
			isSocialCrawler(
				'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			),
		).toBe(false);
	});

	it('returns false for empty user agent', () => {
		expect(isSocialCrawler('')).toBe(false);
	});

	it('is case insensitive', () => {
		expect(isSocialCrawler('whatsapp')).toBe(true);
		expect(isSocialCrawler('WHATSAPP')).toBe(true);
		expect(isSocialCrawler('WhatsApp')).toBe(true);
	});
});

describe('social crawler precision', () => {
	it('treats the Instagram in-app browser as a human', () => {
		expect(
			isSocialCrawler(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; es_MX; es; scale=3.00; 1179x2556)',
			),
		).toBe(false);
	});

	it('treats the Facebook in-app browser as a human', () => {
		expect(
			isSocialCrawler(
				'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
			),
		).toBe(false);
	});

	it('maps crawlers to a family', () => {
		expect(socialCrawlerFamily('WhatsApp/2.24.10.81 A')).toBe('whatsapp');
		expect(socialCrawlerFamily('facebookexternalhit/1.1')).toBe('facebook');
		expect(socialCrawlerFamily('TelegramBot (like TwitterBot)')).toBe('telegram');
		expect(socialCrawlerFamily('Slackbot-LinkExpanding 1.0')).toBe('other');
	});
});
