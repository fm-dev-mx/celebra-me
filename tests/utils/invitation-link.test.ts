import {
	buildInvitationPath,
	buildPublicInvitationPath,
	buildGuestCodePath,
	buildMinimalInvitationPath,
	generateInvitationLink,
} from '@/utils/invitation-link';

describe('buildInvitationPath', () => {
	it('builds the canonical personalized invitation path with query param', () => {
		expect(
			buildInvitationPath({
				eventType: 'xv',
				eventSlug: 'elena-fixture',
				inviteId: 'invite-123',
			}),
		).toBe('/elena-fixture?invite=invite-123');
	});
});

describe('buildMinimalInvitationPath', () => {
	it('builds the clean /i/{shortId} path', () => {
		expect(buildMinimalInvitationPath('abc123')).toBe('/i/abc123');
	});

	it('encodes special characters in shortId', () => {
		expect(buildMinimalInvitationPath('ab c')).toBe('/i/ab%20c');
	});
});

describe('generateInvitationLink', () => {
	it('generates long link when only inviteId is provided', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'elena-fixture',
				inviteId: 'invite-123',
			}),
		).toBe('https://celebra.test/elena-fixture?invite=invite-123');
	});

	it('generates minimal /i/{shortId} link when shortId is provided', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'elena-fixture',
				inviteId: 'invite-123',
				shortId: 'abc123',
			}),
		).toBe('https://celebra.test/i/abc123');
	});

	it('generates /invitacion/ fallback when shortId and event info are missing', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				inviteId: 'invite-123',
			}),
		).toBe('https://celebra.test/invitacion/invite-123');
	});

	it('strips trailing slash from origin', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				shortId: 'xyz789',
				inviteId: 'invite-456',
			}),
		).toBe('https://celebra.test/i/xyz789');
	});

	it('generates long fallback when eventType and eventSlug are available but no shortId', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test',
				eventType: 'boda',
				eventSlug: 'juan-maria',
				inviteId: 'invite-789',
			}),
		).toBe('https://celebra.test/juan-maria?invite=invite-789');
	});
});

describe('buildPublicInvitationPath', () => {
	it.each([
		['xv', 'america', '/america'],
		['boda', 'olivia-y-antonio', '/olivia-y-antonio'],
		['cumple', 'aithan-darell', '/aithan-darell'],
		['xv', 'xv-america', '/xv-america'],
	])('uses the short path for %s/%s', (eventType, slug, expected) => {
		expect(buildPublicInvitationPath(eventType, slug)).toBe(expected);
	});

	it('uses the catalog alias for static catalog demos', () => {
		expect(buildPublicInvitationPath('xv', 'demo-xv-editorial')).toBe('/editorial');
	});

	it('encodes the slug', () => {
		expect(buildPublicInvitationPath('xv', 'a b')).toBe('/a%20b');
	});

	it('never prefixes the slug with the event type', () => {
		expect(buildPublicInvitationPath('boda', 'daniela-y-martin')).not.toContain('/boda/');
	});

	it('builds personalized and generated links on the short path', () => {
		expect(
			buildInvitationPath({ eventType: 'xv', eventSlug: 'america', inviteId: 'invite-1' }),
		).toBe('/america?invite=invite-1');
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'boda',
				eventSlug: 'olivia-y-antonio',
				inviteId: 'invite-2',
			}),
		).toBe('https://celebra.test/olivia-y-antonio?invite=invite-2');
	});

	it('keeps the /i/{shortId} link independent of the route form', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test',
				eventType: 'xv',
				eventSlug: 'america',
				inviteId: 'invite-3',
				shortId: 'k3x9aB',
			}),
		).toBe('https://celebra.test/i/k3x9aB');
	});
});

describe('guest code links', () => {
	it('prefers /{slug}/{guestCode} over /i/{shortId} in shared messages', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'america',
				inviteId: 'invite-4',
				shortId: 'B5NBO65L',
				guestCode: 'k7q2',
			}),
		).toBe('https://celebra.test/america/k7q2');
	});

	it('falls back to /i/{shortId} when the slug keeps the long path', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test',
				eventType: 'xv',
				eventSlug: 'demo-xv-editorial',
				inviteId: 'invite-5',
				shortId: 'B5NBO65L',
				guestCode: 'k7q2',
			}),
		).toBe('https://celebra.test/i/B5NBO65L');
	});

	it('falls back to /i/{shortId} without a slug', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test',
				inviteId: 'invite-6',
				shortId: 'B5NBO65L',
				guestCode: 'k7q2',
			}),
		).toBe('https://celebra.test/i/B5NBO65L');
	});

	it('encodes both segments', () => {
		expect(buildGuestCodePath('a b', 'k7q2')).toBe('/a%20b/k7q2');
	});
});
