import { getSharingConfigForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import type { SharingConfig } from '@/lib/rsvp/services/shared/invitation-helpers';
import { DEFAULT_REMINDER_MESSAGE } from '@/lib/rsvp/services/shared/share-message-defaults';
import * as publishedRepo from '@/lib/intake/repositories/published-invitation-content.repository';
import type { PublishedInvitationContent } from '@/lib/intake/repositories/published-invitation-content.repository';
import * as eventsContent from '@/lib/content/events';
import type { RoutableEventEntry } from '@/lib/content/events';

jest.mock('@/lib/intake/repositories/published-invitation-content.repository');
jest.mock('@/lib/content/events');

function buildPublished(
	overrides: Partial<PublishedInvitationContent>,
): PublishedInvitationContent {
	return {
		id: 'pub-default',
		invitationId: 'inv-default',
		slug: 'default-slug',
		eventType: 'xv',
		isDemo: false,
		content: {},
		version: 1,
		publishedAt: '2026-01-01',
		createdAt: '2026-01-01',
		updatedAt: '2026-01-01',
		...overrides,
	};
}

function expectEmptyConfig(result: SharingConfig) {
	expect(result.shareMessages).toBeUndefined();
}

describe('getSharingConfigForSlug', () => {
	const findPublishedMock = publishedRepo.findPublishedBySlugAndEventType as jest.MockedFunction<
		typeof publishedRepo.findPublishedBySlugAndEventType
	>;
	const getRoutableMock = eventsContent.getRoutableEventEntry as jest.MockedFunction<
		typeof eventsContent.getRoutableEventEntry
	>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('non-demo published content with new shape', () => {
		it('returns shareMessages with invitation and reminder', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'ayrin-samantha-lerma-castro',
					isDemo: false,
					content: {
						sharing: {
							shareMessages: {
								invitation:
									'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
								reminder:
									'Hola {guestName}, recuerda tu invitación a {eventTitle}: {inviteUrl}',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('ayrin-samantha-lerma-castro', 'xv');

			expect(result.shareMessages).toEqual({
				invitation: 'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
				reminder: 'Hola {guestName}, recuerda tu invitación a {eventTitle}: {inviteUrl}',
			});
		});

		it('uses default reminder when only invitation is provided', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'test-slug',
					isDemo: false,
					content: {
						sharing: {
							shareMessages: {
								invitation: 'Custom invitation: {inviteUrl}',
								reminder: '',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('test-slug', 'xv');

			expect(result.shareMessages?.invitation).toBe('Custom invitation: {inviteUrl}');
			expect(result.shareMessages?.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
		});
	});

	describe('legacy backward compatibility', () => {
		it('maps legacy whatsappWithPhone to invitation', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'legacy-slug',
					isDemo: false,
					content: {
						sharing: {
							shareMessages: {
								whatsappWithPhone:
									'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
								whatsappWithoutPhone: 'Te invitamos a {eventTitle}: {inviteUrl}',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('legacy-slug', 'xv');

			expect(result.shareMessages?.invitation).toBe(
				'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
			);
			expect(result.shareMessages?.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
		});

		it('maps legacy whatsappTemplate to invitation', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'legacy-template-slug',
					isDemo: false,
					content: {
						sharing: {
							whatsappTemplate:
								'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('legacy-template-slug', 'xv');

			expect(result.shareMessages?.invitation).toBe(
				'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
			);
			expect(result.shareMessages?.reminder).toBe(DEFAULT_REMINDER_MESSAGE);
		});

		it('prefers new invitation field over legacy whatsappWithPhone', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'mixed-slug',
					isDemo: false,
					content: {
						sharing: {
							shareMessages: {
								invitation: 'New invitation template',
								whatsappWithPhone: 'Legacy with-phone template',
								reminder: 'New reminder template',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('mixed-slug', 'xv');

			expect(result.shareMessages?.invitation).toBe('New invitation template');
			expect(result.shareMessages?.reminder).toBe('New reminder template');
		});
	});

	describe('demo published content', () => {
		it('maps legacy whatsappTemplate from demo to invitation', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-demo-1',
					invitationId: 'inv-demo-1',
					slug: 'demo-xv-enchanted-rose',
					isDemo: true,
					content: {
						sharing: {
							whatsappTemplate:
								'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('demo-xv-enchanted-rose', 'xv');

			expect(result.shareMessages?.invitation).toBe(
				'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
			);
		});
	});

	describe('fallback behavior', () => {
		it('falls back to demo JSON when no published content exists', async () => {
			findPublishedMock.mockResolvedValue(null);
			getRoutableMock.mockResolvedValue({
				id: 'xv/demo-xv-enchanted-rose',
				collection: 'event-demos',
				data: {
					eventType: 'xv',
					isDemo: true,
					sharing: {
						whatsappTemplate:
							'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
					},
				},
			} as unknown as RoutableEventEntry);

			const result = await getSharingConfigForSlug('demo-xv-enchanted-rose', 'xv');

			expect(result.shareMessages?.invitation).toBe(
				'Hola {name}, te comparto la invitación para {eventTitle}: {inviteUrl}',
			);
		});

		it('returns empty config when no published content and no demo exists', async () => {
			findPublishedMock.mockResolvedValue(null);
			getRoutableMock.mockResolvedValue(null);

			const result = await getSharingConfigForSlug('nonexistent-slug', 'xv');

			expectEmptyConfig(result);
		});
	});
});
