import {
	buildInvitationPath,
	buildMinimalInvitationPath,
	generateInvitationLink,
} from '@/utils/invitation-link';

describe('buildInvitationPath', () => {
	it('builds the canonical personalized invitation path with query param', () => {
		expect(
			buildInvitationPath({
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
				inviteId: 'invite-123',
			}),
		).toBe('/xv/ximena-meza-trasvina?invite=invite-123');
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
				eventSlug: 'ximena-meza-trasvina',
				inviteId: 'invite-123',
			}),
		).toBe('https://celebra.test/xv/ximena-meza-trasvina?invite=invite-123');
	});

	it('generates minimal /i/{shortId} link when shortId is provided', () => {
		expect(
			generateInvitationLink({
				origin: 'https://celebra.test/',
				eventType: 'xv',
				eventSlug: 'ximena-meza-trasvina',
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
		).toBe('https://celebra.test/boda/juan-maria?invite=invite-789');
	});
});
