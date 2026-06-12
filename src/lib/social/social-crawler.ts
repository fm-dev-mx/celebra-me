export const SOCIAL_CRAWLER_PATTERN =
	/whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|instagram/i;

export function isSocialCrawler(userAgent: string): boolean {
	return SOCIAL_CRAWLER_PATTERN.test(userAgent);
}
