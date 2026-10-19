jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByShortId: jest.fn(),
}));

jest.mock('@/lib/social/social-crawler', () => ({
	isSocialCrawler: jest.fn(() => false),
}));

jest.mock('@/lib/rsvp/engagement/engagement.service', () => ({
	recordLinkPreview: jest.fn(),
}));

jest.mock('@/lib/invitation/content-resolver', () => ({
	resolvePublicInvitation: jest.fn(),
}));

jest.mock('@/lib/invitation/page-data', () => ({
	buildLayoutData: jest.fn(),
}));

import { resolveShortIdRequest } from '@/lib/invitation/short-id-resolver';
import { getInvitationContextByShortId } from '@/lib/rsvp/services/invitation-context.service';
import { buildWhatsAppShareUrl } from '@/lib/rsvp/services/shared/invitation-helpers';

/**
 * Follows the link a host sends through WhatsApp: the wa.me URL carries the guest's message, the
 * message carries the short link, and the short link lands on `/{eventType}/{slug}?invite=…`.
 */

const SITE_ORIGIN = 'https://www.celebra-me.com';
const mockedGetContext = getInvitationContextByShortId as jest.Mock;

const guest = {
	origin: SITE_ORIGIN,
	inviteId: 'invite-uuid-123',
	phone: '(656) 100-0011',
	countryCode: '+52',
	fullName: 'Francisco Prueba',
	eventTitle: 'Boda de Daniela y Martín',
	eventType: 'boda' as const,
	eventSlug: 'daniela-y-martin',
};

function readShareUrl(shareUrl: string): { phone: string; message: string } {
	const url = new URL(shareUrl);
	expect(url.origin).toBe('https://wa.me');
	return { phone: url.pathname.slice(1), message: url.searchParams.get('text') ?? '' };
}

function linksIn(message: string): URL[] {
	return [...message.matchAll(/https?:\/\/\S+/g)].map(([link]) => new URL(link));
}

describe('WhatsApp send link flow', () => {
	beforeEach(() => {
		mockedGetContext.mockReset();
	});

	it('sends the short link and resolves it to the event route with the invite token', async () => {
		const { phone, message } = readShareUrl(
			buildWhatsAppShareUrl({ ...guest, shortId: 'FXTR7K2M' }),
		);

		expect(phone).toBe('526561000011');
		expect(message).toContain('Francisco Prueba');
		const links = linksIn(message);
		expect(links.map((link) => link.href)).toEqual([`${SITE_ORIGIN}/i/FXTR7K2M`]);

		mockedGetContext.mockResolvedValue({
			inviteId: guest.inviteId,
			eventSlug: guest.eventSlug,
			eventType: guest.eventType,
			eventTitle: guest.eventTitle,
		});
		const shortId = links[0].pathname.split('/').pop();
		const resolution = await resolveShortIdRequest(shortId, 'Mozilla/5.0', SITE_ORIGIN);

		expect(mockedGetContext).toHaveBeenCalledWith('FXTR7K2M');
		expect(resolution).toEqual({
			kind: 'redirect',
			redirectTarget: '/boda/daniela-y-martin?invite=invite-uuid-123',
			canonicalUrl: `${SITE_ORIGIN}/i/FXTR7K2M`,
		});
	});

	it('falls back to the event route with the invite token when there is no short id', () => {
		const { message } = readShareUrl(buildWhatsAppShareUrl(guest));
		const [link] = linksIn(message);

		expect(link.origin).toBe(SITE_ORIGIN);
		expect(link.pathname).toBe('/boda/daniela-y-martin');
		expect(link.searchParams.get('invite')).toBe('invite-uuid-123');
	});

	it('keeps the slug unprefixed by the event type', () => {
		const { message } = readShareUrl(buildWhatsAppShareUrl(guest));
		const [link] = linksIn(message);
		const [eventType, slug] = link.pathname.slice(1).split('/');

		expect(eventType).toBe('boda');
		expect(slug.startsWith(`${eventType}-`)).toBe(false);
	});
});
