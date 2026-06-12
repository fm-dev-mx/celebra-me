import type { ShortIdResolution } from '@/lib/invitation/short-id-resolver';
import type { InvitationViewModel } from '@/lib/adapters/types';

jest.mock('@/lib/rsvp/services/invitation-context.service', () => ({
	getInvitationContextByShortId: jest.fn(),
}));

jest.mock('@/lib/social/social-crawler', () => ({
	isSocialCrawler: jest.fn(),
}));

jest.mock('@/lib/invitation/content-resolver', () => ({
	resolveInvitationContent: jest.fn(),
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

import { resolveShortIdRequest } from '@/lib/invitation/short-id-resolver';
import { getInvitationContextByShortId } from '@/lib/rsvp/services/invitation-context.service';
import { isSocialCrawler } from '@/lib/social/social-crawler';
import { resolveInvitationContent } from '@/lib/invitation/content-resolver';
import { buildLayoutData } from '@/lib/invitation/page-data';

const mockedGetContext = getInvitationContextByShortId as jest.Mock;
const mockedIsCrawler = isSocialCrawler as jest.Mock;
const mockedResolveContent = resolveInvitationContent as jest.Mock;
const mockedBuildLayout = buildLayoutData as jest.Mock;

const SITE_ORIGIN = 'https://www.celebra-me.com';

const validContext = {
	inviteId: 'invite-abc-123',
	eventSlug: 'ayrin-samantha-lerma-castro',
	eventType: 'xv',
	eventTitle: 'XV Años de Ayrin Samantha',
	guest: {
		fullName: 'Francisco Prueba',
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending' as const,
		attendeeCount: 1,
		guestComment: '',
		hideCelebraMeBranding: false,
	},
};

const baseViewModel: InvitationViewModel = {
	id: 'ayrin-samantha-lerma-castro',
	isDemo: false,
	title: 'XV Años de Ayrin Samantha',
	description: 'Una descripción.',
	theme: { preset: 'enchanted-rose', themeClass: 'theme-preset--enchanted-rose' },
	hero: {
		name: 'Ayrin Samantha Lerma Castro',
		secondaryName: '',
		label: 'Mis XV años',
		date: '2026-08-01T18:00:00Z',
		variant: 'enchanted-rose',
		backgroundImage: { src: '/test.webp', alt: 'test' },
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: false,
		showContactCta: false,
		showThankYouBranding: false,
	},
	sectionOrder: [],
	sections: {},
};

function assertIsRedirect(
	r: ShortIdResolution,
): asserts r is Extract<ShortIdResolution, { kind: 'redirect' }> {
	expect(r.kind).toBe('redirect');
}

function assertIsCrawler(
	r: ShortIdResolution,
): asserts r is Extract<ShortIdResolution, { kind: 'crawler' }> {
	expect(r.kind).toBe('crawler');
}

function assertIsError(
	r: ShortIdResolution,
): asserts r is Extract<ShortIdResolution, { kind: 'error' }> {
	expect(r.kind).toBe('error');
}

describe('resolveShortIdRequest', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('when shortId is missing', () => {
		it('returns error for undefined shortId', async () => {
			const result = await resolveShortIdRequest(undefined, '', SITE_ORIGIN);
			assertIsError(result);
		});

		it('returns error for empty shortId', async () => {
			const result = await resolveShortIdRequest('', '', SITE_ORIGIN);
			assertIsError(result);
		});
	});

	describe('when getInvitationContextByShortId throws', () => {
		it('returns error and does not propagate the exception', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => {});
			mockedGetContext.mockRejectedValueOnce(new Error('DB connection failed'));
			const result = await resolveShortIdRequest('ABC123', '', SITE_ORIGIN);
			assertIsError(result);
		});
	});

	describe('when getInvitationContextByShortId returns null/empty context', () => {
		it('returns error when inviteId is falsy', async () => {
			mockedGetContext.mockResolvedValueOnce({ ...validContext, inviteId: '' });
			const result = await resolveShortIdRequest('ABC123', '', SITE_ORIGIN);
			assertIsError(result);
		});
	});

	describe('context resolves successfully — normal browser (non-crawler)', () => {
		beforeEach(() => {
			mockedGetContext.mockResolvedValue(validContext);
			mockedIsCrawler.mockReturnValue(false);
		});

		it('returns redirect with correct redirectTarget path', async () => {
			const result = await resolveShortIdRequest(
				'ABC123',
				'Mozilla/5.0 Chrome/120',
				SITE_ORIGIN,
			);
			assertIsRedirect(result);
			expect(result.redirectTarget).toBe(
				'/xv/ayrin-samantha-lerma-castro?invite=invite-abc-123',
			);
		});

		it('returns redirect with canonicalUrl', async () => {
			const result = await resolveShortIdRequest(
				'ABC123',
				'Mozilla/5.0 Chrome/120',
				SITE_ORIGIN,
			);
			assertIsRedirect(result);
			expect(result.canonicalUrl).toContain('/i/ABC123');
		});

		it('does NOT call resolveInvitationContent for browser requests (no OG needed)', async () => {
			await resolveShortIdRequest('ABC123', 'Mozilla/5.0 Chrome/120', SITE_ORIGIN);
			expect(mockedResolveContent).not.toHaveBeenCalled();
		});
	});

	describe('context resolves successfully — social crawler', () => {
		beforeEach(() => {
			mockedGetContext.mockResolvedValue(validContext);
			mockedIsCrawler.mockReturnValue(true);
		});

		it('returns crawler kind with OG data', async () => {
			mockedResolveContent.mockResolvedValue(null);
			const result = await resolveShortIdRequest(
				'ABC123',
				'WhatsApp/2.24.10.81',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
			expect(result.ogData.ogTitle).toBe('XV Años de Ayrin Samantha');
		});

		it('includes redirectTarget in crawler response (for JS fallback)', async () => {
			mockedResolveContent.mockResolvedValue(null);
			const result = await resolveShortIdRequest(
				'ABC123',
				'WhatsApp/2.24.10.81',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
			expect(result.redirectTarget).toBe(
				'/xv/ayrin-samantha-lerma-castro?invite=invite-abc-123',
			);
		});

		it('includes canonicalUrl in crawler response', async () => {
			mockedResolveContent.mockResolvedValue(null);
			const result = await resolveShortIdRequest(
				'ABC123',
				'WhatsApp/2.24.10.81',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
			expect(result.canonicalUrl).toContain('/i/ABC123');
		});

		it('enriches OG data with resolved invitation content when available', async () => {
			mockedResolveContent.mockResolvedValue({
				source: 'published',
				viewModel: baseViewModel,
				rawContent: {},
			});
			mockedBuildLayout.mockReturnValue({
				title: 'Invitación para Francisco Prueba',
				description: 'Descripción enriquecida',
				image: '/custom-image.webp',
				className: '',
				htmlAttributes: '',
			});
			const result = await resolveShortIdRequest(
				'ABC123',
				'WhatsApp/2.24.10.81',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
			expect(result.ogData.ogTitle).toBe('Invitación para Francisco Prueba');
			expect(result.ogData.ogDescription).toBe('Descripción enriquecida');
		});

		it('falls back to basic OG data when resolveInvitationContent throws', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => {});
			mockedResolveContent.mockRejectedValue(new Error('Content not found'));
			const result = await resolveShortIdRequest(
				'ABC123',
				'WhatsApp/2.24.10.81',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
			expect(result.ogData.ogTitle).toBe('XV Años de Ayrin Samantha');
			expect(result.ogData.ogDescription).toBe(
				'Consulta los detalles de XV Años de Ayrin Samantha y confirma tu asistencia.',
			);
		});
	});

	describe('user-agent detection edge cases', () => {
		beforeEach(() => {
			mockedGetContext.mockResolvedValue(validContext);
		});

		it('redirects when user-agent is null/empty (Vercel edge case)', async () => {
			mockedIsCrawler.mockReturnValue(false);
			const result = await resolveShortIdRequest('ABC123', '', SITE_ORIGIN);
			assertIsRedirect(result);
		});

		it('treats user-agent with Instagram as crawler', async () => {
			jest.spyOn(console, 'error').mockImplementation(() => {});
			mockedIsCrawler.mockImplementation((ua: string) => /whatsapp|instagram/i.test(ua));
			const result = await resolveShortIdRequest(
				'ABC123',
				'Mozilla/5.0 Instagram 123',
				SITE_ORIGIN,
			);
			assertIsCrawler(result);
		});
	});
});
