import { updateShareMessages } from '@/lib/rsvp/services/dashboard-guests.service';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { findEventById } from '@/lib/rsvp/repositories/event.repository';
import {
	findPublishedByInvitationId,
	updatePublishedContentSnapshot,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { ApiError } from '@/lib/rsvp/core/errors';

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventById: jest.fn(),
	findEventByIdService: jest.fn(),
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: jest.fn(),
	updatePublishedContentSnapshot: jest.fn(),
}));

const mockFindEventById = findEventById as jest.MockedFunction<typeof findEventById>;
const mockFindPublished = findPublishedByInvitationId as jest.MockedFunction<
	typeof findPublishedByInvitationId
>;
const mockUpdateSnapshot = updatePublishedContentSnapshot as jest.MockedFunction<
	typeof updatePublishedContentSnapshot
>;

describe('updateShareMessages', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('throws 404 when event is not found', async () => {
		mockFindEventById.mockResolvedValue(null);

		await expect(
			updateShareMessages({
				eventId: 'evt-404',
				hostAccessToken: 'token',
				shareMessages: { invitation: 'Hello', reminder: 'Reminder' },
			}),
		).rejects.toThrow(ApiError);

		expect(mockFindPublished).not.toHaveBeenCalled();
	});

	it('throws 400 when event has no invitationId', async () => {
		mockFindEventById.mockResolvedValue({
			id: 'evt-1',
			invitationId: null,
		} as unknown as EventRecord);

		await expect(
			updateShareMessages({
				eventId: 'evt-1',
				hostAccessToken: 'token',
				shareMessages: { invitation: 'Hello', reminder: 'Reminder' },
			}),
		).rejects.toThrow(ApiError);
	});

	it('throws 404 when no published content exists', async () => {
		mockFindEventById.mockResolvedValue({
			id: 'evt-1',
			invitationId: 'inv-1',
		} as unknown as EventRecord);
		mockFindPublished.mockResolvedValue(null);

		await expect(
			updateShareMessages({
				eventId: 'evt-1',
				hostAccessToken: 'token',
				shareMessages: { invitation: 'Hello', reminder: 'Reminder' },
			}),
		).rejects.toThrow(ApiError);
	});

	it('updates published content with new share messages', async () => {
		mockFindEventById.mockResolvedValue({
			id: 'evt-1',
			invitationId: 'inv-1',
		} as unknown as EventRecord);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			content: {
				sharing: { shareMessages: { invitation: 'Old', reminder: 'Old reminder' } },
			},
			version: 1,
			publishedAt: '2026-01-01T00:00:00.000Z',
		} as never);
		mockUpdateSnapshot.mockResolvedValue(undefined as never);

		const result = await updateShareMessages({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: 'New invitation', reminder: 'New reminder' },
		});

		expect(mockUpdateSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'pub-1', version: 1 }),
		);
		expect(result.shareMessages).toEqual({
			invitation: 'New invitation',
			reminder: 'New reminder',
		});
	});

	it('applies defaults for empty invitation', async () => {
		mockFindEventById.mockResolvedValue({
			id: 'evt-1',
			invitationId: 'inv-1',
		} as unknown as EventRecord);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			content: { sharing: {} },
			version: 1,
			publishedAt: '2026-01-01T00:00:00.000Z',
		} as never);
		mockUpdateSnapshot.mockResolvedValue(undefined as never);

		const result = await updateShareMessages({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: '', reminder: '' },
		});

		expect(result.shareMessages.invitation).toContain('Hola {{invitado}}');
		expect(result.shareMessages.reminder).toContain('Hola {{invitado}}');
	});

	it('persists reminderSettings when provided', async () => {
		mockFindEventById.mockResolvedValue({
			id: 'evt-1',
			invitationId: 'inv-1',
		} as unknown as EventRecord);
		mockFindPublished.mockResolvedValue({
			id: 'pub-1',
			content: { sharing: { shareMessages: { invitation: 'Old', reminder: 'Old' } } },
			version: 1,
			publishedAt: '2026-01-01T00:00:00.000Z',
		} as never);
		mockUpdateSnapshot.mockResolvedValue(undefined as never);

		const result = await updateShareMessages({
			eventId: 'evt-1',
			hostAccessToken: 'token',
			shareMessages: { invitation: 'Inv', reminder: 'Rem' },
			reminderSettings: { enabled: true, showWhenDaysBeforeEvent: 3, audience: 'all-shared' },
		});

		expect(mockUpdateSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					sharing: expect.objectContaining({
						reminderSettings: {
							enabled: true,
							showWhenDaysBeforeEvent: 3,
							audience: 'all-shared',
						},
					}),
				}),
			}),
		);
		expect(result.reminderSettings).toEqual({
			enabled: true,
			showWhenDaysBeforeEvent: 3,
			audience: 'all-shared',
		});
	});
});
