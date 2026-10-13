import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	AI_ASSISTANT_CRAWLERS,
	AI_TRAINING_CRAWLERS,
	INVITATION_PATH_PREFIXES,
	PRIVATE_PATHS,
	buildRobotsPolicy,
} from '@/lib/seo/robots-policy';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';

const policy = buildRobotsPolicy();
const forAgent = (userAgent: string) => policy.find((entry) => entry.userAgent === userAgent);

describe('robots policy', () => {
	it('keeps the site open to every crawler except private paths', () => {
		expect(forAgent('*')).toEqual({ userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] });
	});

	it.each(AI_TRAINING_CRAWLERS)('refuses the whole site to the training crawler %s', (agent) => {
		expect(forAgent(agent)).toEqual({ userAgent: agent, disallow: '/' });
	});

	it.each(AI_ASSISTANT_CRAWLERS)('keeps the assistant %s off invitations only', (agent) => {
		const entry = forAgent(agent);
		expect(entry?.allow).toBe('/');
		expect(entry?.disallow).toEqual(
			expect.arrayContaining([...PRIVATE_PATHS, '/i/', '/vista-previa/']),
		);
		for (const eventType of EVENT_TYPES) {
			expect(entry?.disallow).toContain(`/${eventType}/`);
		}
		expect(entry?.disallow).not.toContain('/demos/');
	});

	it('never names link-preview crawlers, which guests share invitations through', () => {
		const agents = policy.map((entry) => entry.userAgent.toLowerCase());
		for (const preview of [
			'whatsapp',
			'facebookexternalhit',
			'telegrambot',
			'twitterbot',
			'slackbot',
			'discordbot',
			'linkedinbot',
			'applebot',
			'googlebot',
			'bingbot',
		]) {
			expect(agents).not.toContain(preview);
		}
		expect(INVITATION_PATH_PREFIXES).not.toContain('/demos/');
	});

	it('is the policy the robots.txt integration uses', () => {
		const config = readFileSync(resolve('astro.config.mjs'), 'utf8');
		expect(config).toContain('robotsTxt({ policy: buildRobotsPolicy() })');
	});
});
