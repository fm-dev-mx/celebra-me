import { getInvitationDefinition } from '../../scripts/provision/invitations/registry';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release';
import { resolveCountdownTarget } from '../../src/lib/time/event-time';

test('Gerardo displays the local event day without changing the event instant', () => {
	const definition = getInvitationDefinition('gerardo-sesenta');
	const content = definition.buildPublishedContent(buildSemanticAssetMap(definition)) as {
		hero: { date: string };
		eventTiming: { localDateTime: string; timeZone: string; startsAtUtc: string };
	};
	expect(content.hero.date.slice(0, 10)).toBe('2026-02-21');
	expect(content.eventTiming).toEqual({
		localDateTime: '2026-02-21T20:00',
		timeZone: 'America/Mazatlan',
		startsAtUtc: '2026-02-22T03:00:00.000Z',
	});
	expect(resolveCountdownTarget(content.eventTiming, content.hero.date)?.targetIso).toBe('2026-02-22T03:00:00.000Z');
});
