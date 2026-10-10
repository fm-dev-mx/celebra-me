import type { CrawlerFamily } from '@/lib/rsvp/engagement/taxonomy';

/**
 * Link-preview crawlers that must receive the Open Graph shell instead of a redirect.
 * In-app browsers (Instagram, Facebook) are human traffic: their previews are fetched by
 * facebookexternalhit, so the bare word "instagram" must not match.
 */
export const SOCIAL_CRAWLER_PATTERN =
	/whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot/i;

export function isSocialCrawler(userAgent: string): boolean {
	return SOCIAL_CRAWLER_PATTERN.test(userAgent);
}

export function socialCrawlerFamily(userAgent: string): CrawlerFamily {
	if (/whatsapp/i.test(userAgent)) return 'whatsapp';
	if (/facebookexternalhit|facebot/i.test(userAgent)) return 'facebook';
	if (/telegrambot/i.test(userAgent)) return 'telegram';
	return 'other';
}
