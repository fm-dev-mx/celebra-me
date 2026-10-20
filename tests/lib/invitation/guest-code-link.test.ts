jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByShortId: jest.fn(),
	getInvitationContextBySlugAndCode: jest.fn(),
}));

jest.mock('@/lib/social/social-crawler', () => ({
	isSocialCrawler: jest.fn(),
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

jest.mock('@/lib/invitation/social-metadata', () => ({
	buildSocialImageMetadata: jest.fn(() => ({
		url: 'https://www.celebra-me.com/images/og-image.webp',
		width: 1200,
		height: 630,
		type: 'image/webp',
	})),
}));

import {
	buildShortIdEarlyResponse,
	resolveGuestCodePage,
	resolveGuestCodeRequest,
	resolveShortIdPage,
} from '@/lib/invitation/short-id-resolver';
import { GUEST_LINK_FAILURE_LIMIT } from '@/lib/invitation/guest-link-rate-limit';
import { ApiError } from '@/lib/rsvp/core/errors';
import { resetRateLimitProviderForTests } from '@/lib/rsvp/security/rate-limit-provider';
import {
	getInvitationContextBySlugAndCode,
	getInvitationContextByShortId,
} from '@/lib/rsvp/services/invitation-context.service';
import { isSocialCrawler } from '@/lib/social/social-crawler';
import { resolvePublicInvitation } from '@/lib/invitation/content-resolver';
import { buildLayoutData } from '@/lib/invitation/page-data';

const mockedBySlugAndCode = getInvitationContextBySlugAndCode as jest.Mock;
const mockedByShortId = getInvitationContextByShortId as jest.Mock;
const mockedIsCrawler = isSocialCrawler as jest.Mock;

const SITE_ORIGIN = 'https://www.celebra-me.com';

const americaContext = {
	inviteId: 'invite-america-1',
	eventSlug: 'america',
	eventType: 'xv',
	eventTitle: 'XV Años de América',
	brandingRemovalEnabled: false,
	guest: {
		fullName: 'Francisco Prueba',
		maxAllowedAttendees: 2,
		attendanceStatus: 'pending' as const,
		attendeeCount: 0,
		guestComment: '',
		hideCelebraMeBranding: false,
	},
};

function guestRequest(path: string, ip: string, userAgent = 'Mozilla/5.0'): Request {
	return new Request(`${SITE_ORIGIN}${path}`, {
		headers: { 'user-agent': userAgent, 'x-forwarded-for': ip },
	});
}

const notFound = () => new ApiError(404, 'not_found', 'Invitation not found.');

beforeEach(() => {
	jest.clearAllMocks();
	resetRateLimitProviderForTests();
});

describe('resolveGuestCodeRequest', () => {
	it('redirects a person to the personalized invitation', async () => {
		mockedBySlugAndCode.mockResolvedValue(americaContext);
		mockedIsCrawler.mockReturnValue(false);

		const result = await resolveGuestCodeRequest('america', 'k7q2', 'Mozilla/5.0', SITE_ORIGIN);

		expect(mockedBySlugAndCode).toHaveBeenCalledWith('america', 'k7q2');
		expect(result).toEqual({
			kind: 'redirect',
			redirectTarget: '/america?invite=invite-america-1',
			canonicalUrl: 'https://www.celebra-me.com/america/k7q2',
		});
	});

	it('gives WhatsApp the personalized card on the new canonical URL', async () => {
		mockedBySlugAndCode.mockResolvedValue(americaContext);
		mockedIsCrawler.mockReturnValue(true);
		(resolvePublicInvitation as jest.Mock).mockResolvedValue({
			source: 'published',
			viewModel: {},
		});
		(buildLayoutData as jest.Mock).mockReturnValue({
			title: 'Invitación para Francisco Prueba',
			description: 'Acompáñenos',
			image: null,
		});

		const result = await resolveGuestCodeRequest(
			'america',
			'k7q2',
			'WhatsApp/2.24.10.81 A',
			SITE_ORIGIN,
		);

		expect(result.kind).toBe('crawler');
		if (result.kind !== 'crawler') return;
		expect(result.ogData.ogTitle).toBe('Invitación para Francisco Prueba');
		expect(result.canonicalUrl).toBe('https://www.celebra-me.com/america/k7q2');
		expect(buildLayoutData).toHaveBeenCalledWith({}, 'Francisco Prueba');
	});

	it('answers not found when the code belongs to another invitation', async () => {
		mockedBySlugAndCode.mockRejectedValue(notFound());

		const result = await resolveGuestCodeRequest(
			'olivia-y-antonio',
			'k7q2',
			'Mozilla/5.0',
			SITE_ORIGIN,
		);

		expect(result).toEqual({ kind: 'error', notFound: true });
	});

	it('does not treat an outage as an unknown code', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => {});
		mockedBySlugAndCode.mockRejectedValue(new Error('connection refused'));

		const result = await resolveGuestCodeRequest('america', 'k7q2', 'Mozilla/5.0', SITE_ORIGIN);

		expect(result).toEqual({ kind: 'error', notFound: false });
	});
});

describe('failed-code limit', () => {
	async function spendFailures(ip: string, count: number) {
		mockedBySlugAndCode.mockRejectedValue(notFound());
		for (let i = 0; i < count; i++) {
			const result = await resolveGuestCodePage(
				'america',
				'zzzz',
				guestRequest('/america/zzzz', ip),
				SITE_ORIGIN,
			);
			expect(result).toEqual({ kind: 'error' });
		}
	}

	it('blocks the new route and /i/ after 20 unknown codes from one connection', async () => {
		mockedIsCrawler.mockReturnValue(false);
		await spendFailures('203.0.113.7', GUEST_LINK_FAILURE_LIMIT.maxHits);

		mockedBySlugAndCode.mockResolvedValue(americaContext);
		mockedByShortId.mockResolvedValue(americaContext);
		const viaCode = await resolveGuestCodePage(
			'america',
			'k7q2',
			guestRequest('/america/k7q2', '203.0.113.7'),
			SITE_ORIGIN,
		);
		const viaShortId = await resolveShortIdPage(
			'B5NBO65L',
			guestRequest('/i/B5NBO65L', '203.0.113.7'),
			SITE_ORIGIN,
		);

		expect(viaCode).toEqual({ kind: 'blocked' });
		expect(viaShortId).toEqual({ kind: 'blocked' });
		expect(mockedByShortId).not.toHaveBeenCalled();
	});

	it('counts unknown /i/ codes toward the same limit', async () => {
		mockedByShortId.mockRejectedValue(notFound());
		for (let i = 0; i < GUEST_LINK_FAILURE_LIMIT.maxHits; i++) {
			await resolveShortIdPage(
				'NOPE0000',
				guestRequest('/i/NOPE0000', '203.0.113.8'),
				SITE_ORIGIN,
			);
		}

		const result = await resolveGuestCodePage(
			'america',
			'k7q2',
			guestRequest('/america/k7q2', '203.0.113.8'),
			SITE_ORIGIN,
		);

		expect(result).toEqual({ kind: 'blocked' });
	});

	it('still lets the connection in after 19 failures, and other connections always', async () => {
		mockedIsCrawler.mockReturnValue(false);
		await spendFailures('203.0.113.9', GUEST_LINK_FAILURE_LIMIT.maxHits - 1);
		mockedBySlugAndCode.mockResolvedValue(americaContext);

		const sameConnection = await resolveGuestCodePage(
			'america',
			'k7q2',
			guestRequest('/america/k7q2', '203.0.113.9'),
			SITE_ORIGIN,
		);
		await spendFailures('203.0.113.10', GUEST_LINK_FAILURE_LIMIT.maxHits);
		mockedBySlugAndCode.mockResolvedValue(americaContext);
		const otherConnection = await resolveGuestCodePage(
			'america',
			'k7q2',
			guestRequest('/america/k7q2', '203.0.113.11'),
			SITE_ORIGIN,
		);

		expect(sameConnection.kind).toBe('redirect');
		expect(otherConnection.kind).toBe('redirect');
	});

	it('does not count successful links or outages', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => {});
		mockedIsCrawler.mockReturnValue(false);
		mockedBySlugAndCode.mockResolvedValue(americaContext);
		for (let i = 0; i < 25; i++) {
			await resolveGuestCodePage(
				'america',
				'k7q2',
				guestRequest('/america/k7q2', '203.0.113.12'),
				SITE_ORIGIN,
			);
		}
		mockedBySlugAndCode.mockRejectedValue(new Error('connection refused'));
		for (let i = 0; i < 25; i++) {
			await resolveGuestCodePage(
				'america',
				'k7q2',
				guestRequest('/america/k7q2', '203.0.113.12'),
				SITE_ORIGIN,
			);
		}
		mockedBySlugAndCode.mockResolvedValue(americaContext);

		const result = await resolveGuestCodePage(
			'america',
			'k7q2',
			guestRequest('/america/k7q2', '203.0.113.12'),
			SITE_ORIGIN,
		);

		expect(result.kind).toBe('redirect');
	});

	it('answers a blocked connection with a private 429', () => {
		const response = buildShortIdEarlyResponse(
			{ kind: 'blocked' },
			{ status: 200, headers: new Headers() },
		);

		expect(response?.status).toBe(429);
		expect(response?.headers.get('Retry-After')).toBe('3600');
		expect(response?.headers.get('Cache-Control')).toBe('no-store, private');
	});
});
