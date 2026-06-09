import { getSharingConfigForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import type { SharingConfig } from '@/lib/rsvp/services/shared/invitation-helpers';
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
	expect(result.whatsappTemplate).toBeUndefined();
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

	describe('non-demo published content', () => {
		it('returns shareMessages when both shareMessages and legacy whatsappTemplate exist', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'ayrin-samantha-lerma-castro',
					isDemo: false,
					content: {
						sharing: {
							whatsappTemplate:
								'Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}',
							shareMessages: {
								whatsappWithPhone:
									'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
								whatsappWithoutPhone: 'Te invitamos a {eventTitle}: {inviteUrl}',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('ayrin-samantha-lerma-castro', 'xv');

			expect(result.shareMessages).toEqual({
				whatsappWithPhone: 'Hola {guestName}, te invitamos a {eventTitle}: {inviteUrl}',
				whatsappWithoutPhone: 'Te invitamos a {eventTitle}: {inviteUrl}',
			});
			expect(result.whatsappTemplate).toBeUndefined();
		});

		it('preserves legacy whatsappTemplate when no shareMessages exist', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'ayrin-samantha-lerma-castro',
					isDemo: false,
					content: {
						sharing: {
							whatsappTemplate:
								'Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}',
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('ayrin-samantha-lerma-castro', 'xv');

			expect(result.whatsappTemplate).toBe(
				'Hola {name}, te comparto la invitación para los XV años de Isabella Rose: {inviteUrl}',
			);
			expect(result.shareMessages).toBeUndefined();
		});

		it('strips legacy whatsappTemplate when shareMessages present', async () => {
			findPublishedMock.mockResolvedValue(
				buildPublished({
					id: 'pub-1',
					invitationId: 'inv-1',
					slug: 'ayrin-samantha-lerma-castro',
					isDemo: false,
					content: {
						sharing: {
							whatsappTemplate: 'Hola {name}, legacy template: {inviteUrl}',
							shareMessages: {
								whatsappWithPhone:
									'Hola {guestName}, shareMessages template: {inviteUrl}',
								whatsappWithoutPhone:
									'ShareMessages no phone: {eventTitle}: {inviteUrl}',
							},
						},
					},
				}),
			);

			const result = await getSharingConfigForSlug('ayrin-samantha-lerma-castro', 'xv');

			expect(result.shareMessages).toEqual({
				whatsappWithPhone: 'Hola {guestName}, shareMessages template: {inviteUrl}',
				whatsappWithoutPhone: 'ShareMessages no phone: {eventTitle}: {inviteUrl}',
			});
			expect(result.whatsappTemplate).toBeUndefined();
		});
	});

	describe('demo published content', () => {
		it('preserves legacy whatsappTemplate', async () => {
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

			expect(result.whatsappTemplate).toBe(
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

			expect(result.whatsappTemplate).toBe(
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
