import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
	buildInvitationPath,
	buildShortInvitationPath,
	generateInvitationLink,
} from '@/utils/invitation-link';

describe('invitation-link contract', () => {
	it('builds the canonical personalized invitation path', () => {
		expect(
			buildInvitationPath({
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
				inviteId: 'invite-123',
			}),
		).toBe('/xv/ximena-meza-trasvina?invite=invite-123');
	});

	it('generates canonical long and short invitation links from one source of truth', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
				inviteId: 'invite-123',
			}),
		).toBe('https://celebra.test/xv/ximena-meza-trasvina?invite=invite-123');

		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
				inviteId: 'invite-123',
				shortId: 'abc123',
			}),
		).toBe('https://celebra.test/xv/ximena-meza-trasvina/i/abc123');

		expect(
			buildShortInvitationPath({
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
				shortId: 'abc123',
			}),
		).toBe('/xv/ximena-meza-trasvina/i/abc123');
	});

	it('keeps the short-link redirect aligned with the canonical invite path helper', () => {
		const routePath = path.resolve(
			process.cwd(),
			'src/pages/[eventType]/[slug]/i/[shortId].astro',
		);
		const source = readFileSync(routePath, 'utf8');

		expect(source).toContain("import { buildInvitationPath } from '@/utils/invitation-link'");
		expect(source).toContain('return Astro.redirect(');
		expect(source).toContain('buildInvitationPath({');
	});
});
