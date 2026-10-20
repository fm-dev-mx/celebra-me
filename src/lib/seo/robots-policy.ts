/**
 * robots.txt policy (loaded by astro.config.mjs, so imports stay relative).
 *
 * - Every crawler: the site is open except private paths.
 * - AI training crawlers: nothing (the whole site).
 * - AI search and assistant agents: the landing and demos, never client invitations or
 *   short links.
 *
 * Link-preview crawlers (WhatsApp, facebookexternalhit, Telegram, X, Slack, Discord,
 * LinkedIn, Apple) are deliberately absent: guests share invitations through them.
 * robots.txt only expresses a preference; enforcement belongs to the edge firewall.
 */
import { EVENT_TYPES } from '../theme/theme-contract';

export const PRIVATE_PATHS = ['/dashboard/', '/api/', '/r/', '/captura/'] as const;

export const AI_TRAINING_CRAWLERS = [
	'GPTBot',
	'ClaudeBot',
	'anthropic-ai',
	'CCBot',
	'Google-Extended',
	'Applebot-Extended',
	'Bytespider',
	'meta-externalagent',
	'FacebookBot',
	'Amazonbot',
	'cohere-ai',
	'cohere-training-data-crawler',
	'Diffbot',
	'ImagesiftBot',
	'Omgilibot',
	'Omgili',
	'Timpibot',
	'AI2Bot',
	'Ai2Bot-Dolma',
	'PanguBot',
	'Kangaroo Bot',
	'Webzio-Extended',
	'img2dataset',
] as const;

export const AI_ASSISTANT_CRAWLERS = [
	'OAI-SearchBot',
	'ChatGPT-User',
	'Claude-SearchBot',
	'Claude-User',
	'PerplexityBot',
	'Perplexity-User',
	'MistralAI-User',
	'DuckAssistBot',
	'YouBot',
	'meta-externalfetcher',
] as const;

/** Client invitation routes and personalized short links. */
export const INVITATION_PATH_PREFIXES = [
	...EVENT_TYPES.map((eventType) => `/${eventType}/`),
	'/i/',
] as const;

export interface RobotsPolicyEntry {
	userAgent: string;
	allow?: string | string[];
	disallow?: string | string[];
}

export function buildRobotsPolicy(): RobotsPolicyEntry[] {
	return [
		{ userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] },
		...AI_TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, disallow: '/' })),
		...AI_ASSISTANT_CRAWLERS.map((userAgent) => ({
			userAgent,
			allow: '/',
			disallow: [...PRIVATE_PATHS, ...INVITATION_PATH_PREFIXES],
		})),
	];
}
