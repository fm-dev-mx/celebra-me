import { act, renderHook, waitFor } from '@testing-library/react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { guestsApi } from '@/lib/dashboard/guests-api';

jest.mock('@/lib/dashboard/guests-api', () => ({
	guestsApi: {
		listEvents: jest.fn(),
		list: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		markShared: jest.fn(),
		bulkImport: jest.fn(),
		exportCsv: jest.fn(),
	},
}));

class MockEventSource {
	addEventListener = jest.fn();
	close = jest.fn();
	onerror: (() => void) | null = null;

	constructor(
		public url: string,
		public options?: EventSourceInit,
	) {}
}

const mockedGuestsApi = guestsApi as jest.Mocked<typeof guestsApi>;

const sampleGuest: DashboardGuestItem = {
	guestId: 'guest-123',
	inviteId: 'invite-123',
	fullName: 'Test Guest',
	phone: '5551234567',
	email: null,
	tags: [],
	metadata: {},
	maxAllowedAttendees: 4,
	attendanceStatus: 'pending',
	attendeeCount: 0,
	guestMessage: '',
	deliveryStatus: 'generated',
	firstViewedAt: null,
	respondedAt: null,
	waShareUrl: 'https://wa.me/123',
	shareText: 'Share text',
	updatedAt: '2026-03-22T00:00:00.000Z',
};

const sampleTotals = {
	totalInvitations: 1,
	totalPeople: 4,
	pendingInvitations: 1,
	pendingPeople: 4,
	confirmedInvitations: 0,
	confirmedPeople: 0,
	declinedInvitations: 0,
	declinedPeople: 0,
	viewed: 0,
};

describe('active guest dashboard hooks', () => {
	const originalEventSource = (global as unknown as { EventSource?: unknown }).EventSource;

	beforeEach(() => {
		(global as unknown as { EventSource: unknown }).EventSource = MockEventSource;
		jest.clearAllMocks();
		window.localStorage.clear();
	});

	afterEach(() => {
		(global as unknown as { EventSource?: unknown }).EventSource = originalEventSource;
		jest.restoreAllMocks();
	});

	it('loads events and guest list through useGuestDashboardRealtime', async () => {
		mockedGuestsApi.listEvents.mockResolvedValue({
			items: [
				{
					id: 'event-123',
					title: 'XV Ximena',
					slug: 'ximena',
					eventType: 'xv',
					status: 'published',
				},
			],
		});
		mockedGuestsApi.list.mockResolvedValue({
			eventId: 'event-123',
			items: [sampleGuest],
			totals: sampleTotals,
			updatedAt: '2026-03-22T00:00:00.000Z',
		});

		const onNotification = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: 'event-123',
				search: '',
				status: 'all',
				onNotification,
			}),
		);

		await waitFor(() => {
			expect(result.current.items).toEqual([sampleGuest]);
		});

		expect(mockedGuestsApi.listEvents).toHaveBeenCalledTimes(1);
		expect(mockedGuestsApi.list).toHaveBeenCalledWith({
			eventId: 'event-123',
			search: '',
			status: 'all',
		});
		expect(result.current.hostEvents).toHaveLength(1);
		expect(result.current.eventId).toBe('event-123');
		expect(result.current.inviteBaseUrl).toBe(window.location.origin);
		expect(result.current.error).toBe('');
	});

	it('creates guests through useGuestDashboardActions and refreshes the active runtime', async () => {
		mockedGuestsApi.create.mockResolvedValue({
			...sampleGuest,
			fullName: 'Created Guest',
		});

		const loadGuests = jest.fn().mockResolvedValue(undefined);
		const setItems = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardActions({
				eventId: 'event-123',
				items: [sampleGuest],
				loadGuests,
				setItems,
			}),
		);

		act(() => {
			result.current.openCreateModal();
		});

		await act(async () => {
			await result.current.handleSubmit({
				fullName: 'Created Guest',
				maxAllowedAttendees: 4,
			});
		});

		expect(mockedGuestsApi.create).toHaveBeenCalledWith({
			eventId: 'event-123',
			fullName: 'Created Guest',
			maxAllowedAttendees: 4,
		});
		expect(loadGuests).toHaveBeenCalled();
		expect(result.current.notification).toEqual({
			message: 'Invitado Created Guest correctamente.',
			type: 'success',
		});
	});

	it('shows a sync warning when the host has no visible events', async () => {
		mockedGuestsApi.listEvents.mockResolvedValue({
			items: [],
			debug: {
				session: {
					hasAccessToken: true,
					tokenSource: 'cookie',
					reason: 'session_role_resolved',
					userId: 'host-1',
					email: 'host@test.com',
					role: 'host_client',
					isSuperAdmin: false,
				},
				ownerEvents: [],
				visibleEvents: [],
				memberships: [],
				membershipResolvedEvents: [],
				unresolvedMembershipEventIds: [],
				slugCheck: {
					expectedSlug: 'ximena-meza-trasvina',
					slugExistsInDb: false,
					eventId: null,
					ownerUserId: null,
					title: null,
				},
			},
		});

		const onNotification = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: '',
				search: '',
				status: 'all',
				onNotification,
			}),
		);

		await waitFor(() => {
			expect(result.current.error).toContain('no existe en la base activa');
		});

		expect(mockedGuestsApi.list).not.toHaveBeenCalled();
		expect(result.current.hostEvents).toEqual([]);
	});

	it('shows a visibility error when the requested event is not in the host list', async () => {
		mockedGuestsApi.listEvents.mockResolvedValue({
			items: [
				{
					id: 'event-999',
					title: 'Otro Evento',
					slug: 'otro-evento',
					eventType: 'xv',
					status: 'published',
				},
			],
		});
		mockedGuestsApi.list.mockResolvedValue({
			eventId: 'event-999',
			items: [sampleGuest],
			totals: sampleTotals,
			updatedAt: '2026-03-22T00:00:00.000Z',
		});

		const onNotification = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: 'event-123',
				search: '',
				status: 'all',
				onNotification,
			}),
		);

		await waitFor(() => {
			expect(result.current.error).toContain('El evento solicitado no esta disponible');
		});

		expect(result.current.eventId).toBe('event-999');
	});

	it('shows an RLS or migration error when memberships exist but their events cannot be resolved', async () => {
		mockedGuestsApi.listEvents.mockResolvedValue({
			items: [],
			debug: {
				session: {
					hasAccessToken: true,
					tokenSource: 'cookie',
					reason: 'session_role_resolved',
					userId: 'host-1',
					email: 'host@test.com',
					role: 'host_client',
					isSuperAdmin: false,
				},
				ownerEvents: [],
				visibleEvents: [],
				memberships: [
					{
						id: 'membership-1',
						eventId: 'evt-hidden',
						userId: 'host-1',
						membershipRole: 'manager',
					},
				],
				membershipResolvedEvents: [],
				unresolvedMembershipEventIds: ['evt-hidden'],
				slugCheck: {
					expectedSlug: 'ximena-meza-trasvina',
					slugExistsInDb: true,
					eventId: 'evt-ximena',
					ownerUserId: 'other-host',
					title: 'XV Ximena',
				},
			},
		});

		const onNotification = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: '',
				search: '',
				status: 'all',
				onNotification,
			}),
		);

		await waitFor(() => {
			expect(result.current.error).toContain('Revisa RLS o migraciones');
		});
	});

	it('confirms guest deletion through useGuestDashboardActions', async () => {
		mockedGuestsApi.delete.mockResolvedValue({ message: 'Deleted successfully' });

		const loadGuests = jest.fn().mockResolvedValue(undefined);
		const setItems = jest.fn();
		const { result } = renderHook(() =>
			useGuestDashboardActions({
				eventId: 'event-123',
				items: [sampleGuest],
				loadGuests,
				setItems,
			}),
		);

		act(() => {
			result.current.requestDelete(sampleGuest);
		});

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		expect(mockedGuestsApi.delete).toHaveBeenCalledWith('guest-123');
		expect(loadGuests).toHaveBeenCalled();
		expect(result.current.notification).toEqual({
			message: 'Invitado Test Guest eliminado con éxito.',
			type: 'success',
		});
	});
});
