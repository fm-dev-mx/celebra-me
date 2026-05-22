import { act, renderHook, waitFor } from '@testing-library/react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { makeGuest } from '@tests/helpers/guest-factory';

jest.mock('@/lib/dashboard/guests-api', () => ({
	guestsApi: {
		listEvents: jest.fn(),
		list: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		markShared: jest.fn(),
		revertShared: jest.fn(),
		bulkImport: jest.fn(),
		exportCsv: jest.fn(),
	},
}));

const mockedGuestsApi = guestsApi as jest.Mocked<typeof guestsApi>;

const sampleGuest: DashboardGuestItem = makeGuest({
	guestId: 'guest-123',
	fullName: 'Test Guest',
	phone: '5551234567',
	waShareUrl: 'https://wa.me/123',
});

const sampleTotals = {
	totalInvitations: 1,
	totalPeople: 4,
	generatedInvitations: 1,
	sharedInvitations: 0,
	pendingInvitations: 1,
	pendingPeople: 4,
	confirmedInvitations: 0,
	confirmedPeople: 0,
	declinedInvitations: 0,
	declinedPeople: 0,
	viewed: 0,
};

function setupActions(overrides?: {
	eventId?: string;
	items?: DashboardGuestItem[];
	loadGuests?: jest.Mock;
	setItems?: jest.Mock;
}) {
	const opts = {
		eventId: 'event-123',
		items: [sampleGuest],
		loadGuests: jest.fn().mockResolvedValue(undefined),
		setItems: jest.fn(),
		...overrides,
	};
	const { result } = renderHook(() => useGuestDashboardActions({ ...opts }));
	return { result, loadGuests: opts.loadGuests, setItems: opts.setItems };
}

describe('active guest dashboard hooks', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		window.localStorage.clear();
	});

	afterEach(() => {
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

		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: 'event-123',
				search: '',
				status: 'all',
				delivery: 'all',
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
			delivery: 'all',
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

		const { result, loadGuests } = setupActions();

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
				requestedSlugCheck: null,
			},
		});

		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: '',
				search: '',
				status: 'all',
				delivery: 'all',
			}),
		);

		await waitFor(() => {
			expect(result.current.error).toContain('No hay eventos asignados');
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

		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: 'event-123',
				search: '',
				status: 'all',
				delivery: 'all',
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
				requestedSlugCheck: null,
			},
		});

		const { result } = renderHook(() =>
			useGuestDashboardRealtime({
				initialEventId: '',
				search: '',
				status: 'all',
				delivery: 'all',
			}),
		);

		await waitFor(() => {
			expect(result.current.error).toContain('Revisa RLS o migraciones');
		});
	});

	it('confirms guest deletion through useGuestDashboardActions', async () => {
		mockedGuestsApi.delete.mockResolvedValue({ message: 'Deleted successfully' });

		const { result, loadGuests } = setupActions();

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

	it('reverts shared status through useGuestDashboardActions', async () => {
		mockedGuestsApi.revertShared.mockResolvedValue({
			...sampleGuest,
			deliveryStatus: 'generated',
		});

		const sentGuest = { ...sampleGuest, deliveryStatus: 'shared' as const };
		const { result, loadGuests } = setupActions({ items: [sentGuest] });

		await act(async () => {
			await result.current.handleRevertShared(sentGuest);
		});

		expect(mockedGuestsApi.revertShared).toHaveBeenCalledWith(sentGuest.guestId);
		expect(loadGuests).not.toHaveBeenCalled();
	});

	it('marks guest as shared without calling loadGuests', async () => {
		mockedGuestsApi.markShared.mockResolvedValue({
			...sampleGuest,
			deliveryStatus: 'shared',
		});

		const { result, loadGuests } = setupActions();

		await act(async () => {
			await result.current.handleMarkShared(sampleGuest);
		});

		expect(mockedGuestsApi.markShared).toHaveBeenCalledWith(sampleGuest.guestId);
		expect(loadGuests).not.toHaveBeenCalled();
		expect(result.current.notification).toEqual({
			message: 'Entrega registrada correctamente.',
			type: 'success',
		});
	});

	it('rolls back optimistic update on markShared API failure', async () => {
		mockedGuestsApi.markShared.mockRejectedValue(new Error('Network error'));

		const { result } = setupActions();

		await act(async () => {
			await result.current.handleMarkShared(sampleGuest);
		});

		expect(result.current.notification).toEqual({
			message: 'Error al actualizar estado.',
			type: 'warning',
		});
	});

	it('opens send-pending mode when openNextGeneratedGuest is called', () => {
		const items = [makeGuest({ deliveryStatus: 'generated' })];
		const { result } = setupActions({ items });

		act(() => {
			result.current.openNextGeneratedGuest();
		});

		expect(result.current.modalMode).toBe('send-pending');
		expect(result.current.modalOpen).toBe(true);
		expect(result.current.editingGuest).toBe(items[0]);
	});

	it('does not open modal when no pending guests exist', () => {
		const items = [makeGuest({ deliveryStatus: 'shared' })];
		const { result } = setupActions({ items });

		act(() => {
			result.current.openNextGeneratedGuest();
		});

		expect(result.current.modalOpen).toBe(false);
	});

	it('handleSaveInvitation updates name, max attendees, phone, and countryCode when changed', async () => {
		const guestA = makeGuest({ guestId: 'guest-a', deliveryStatus: 'generated' });

		mockedGuestsApi.update.mockResolvedValue({
			...guestA,
			fullName: 'New Name',
			maxAllowedAttendees: 2,
			phone: '6691234567',
			countryCode: '+52',
		});

		const { result } = setupActions({ items: [guestA] });

		const updated = await act(async () => {
			return result.current.handleSaveInvitation('guest-a', {
				fullName: 'New Name',
				maxAllowedAttendees: 2,
				phone: '6691234567',
				countryCode: '+52',
			});
		});

		expect(mockedGuestsApi.update).toHaveBeenCalledWith('guest-a', {
			fullName: 'New Name',
			maxAllowedAttendees: 2,
			phone: '6691234567',
			countryCode: '+52',
		});
		expect(mockedGuestsApi.markShared).not.toHaveBeenCalled();
		expect(updated.phone).toBe('6691234567');
	});

	it('handleSaveInvitation calls update even when no fields changed', async () => {
		mockedGuestsApi.update.mockResolvedValue(sampleGuest);

		const guestA = makeGuest({
			guestId: 'guest-a',
			fullName: 'Test Guest',
			phone: '5551234567',
			countryCode: '+52',
			deliveryStatus: 'generated',
		});
		const { result } = setupActions({ items: [guestA] });

		await act(async () => {
			await result.current.handleSaveInvitation('guest-a', {
				fullName: 'Test Guest',
				maxAllowedAttendees: 4,
				phone: '5551234567',
				countryCode: '+52',
			});
		});

		expect(mockedGuestsApi.update).toHaveBeenCalledWith('guest-a', {
			fullName: 'Test Guest',
			maxAllowedAttendees: 4,
			phone: '5551234567',
			countryCode: '+52',
		});
	});

	it('handleAdvanceFromGuest advances editingGuest to next pending guest', () => {
		const guest1 = makeGuest({
			guestId: 'g1',
			fullName: 'Guest A',
			deliveryStatus: 'generated',
		});
		const guest2 = makeGuest({
			guestId: 'g2',
			fullName: 'Guest B',
			deliveryStatus: 'generated',
		});
		const { result } = setupActions({ items: [guest1, guest2] });

		act(() => {
			result.current.openNextGeneratedGuest();
		});
		expect(result.current.editingGuest?.guestId).toBe('g1');

		act(() => {
			result.current.handleAdvanceFromGuest('g1');
		});

		expect(result.current.editingGuest?.guestId).toBe('g2');
		expect(result.current.modalOpen).toBe(true);
	});

	it('handleAdvanceFromGuest closes modal when no more pending guests', () => {
		const guest1 = makeGuest({
			guestId: 'g1',
			fullName: 'Guest A',
			deliveryStatus: 'generated',
		});
		const { result } = setupActions({ items: [guest1] });

		act(() => {
			result.current.openNextGeneratedGuest();
		});
		expect(result.current.editingGuest?.guestId).toBe('g1');

		act(() => {
			result.current.handleAdvanceFromGuest('g1');
		});

		expect(result.current.modalOpen).toBe(false);
		expect(result.current.isNextActionActive).toBe(false);
	});

	it('handleAdvanceFromGuest does nothing when guestId does not match editingGuest', () => {
		const guest1 = makeGuest({
			guestId: 'g1',
			fullName: 'Guest A',
			deliveryStatus: 'generated',
		});
		const { result } = setupActions({ items: [guest1] });

		act(() => {
			result.current.openNextGeneratedGuest();
		});

		act(() => {
			result.current.handleAdvanceFromGuest('wrong-id');
		});

		expect(result.current.editingGuest?.guestId).toBe('g1');
		expect(result.current.modalOpen).toBe(true);
	});

	it('handlePostpone advances to next pending guest', async () => {
		const guest1 = makeGuest({
			guestId: 'g1',
			fullName: 'Guest A',
			deliveryStatus: 'generated',
		});
		const guest2 = makeGuest({
			guestId: 'g2',
			fullName: 'Guest B',
			deliveryStatus: 'generated',
		});
		const items = [guest1, guest2];
		const { result } = setupActions({ items });

		act(() => {
			result.current.openNextGeneratedGuest();
		});
		expect(result.current.editingGuest?.guestId).toBe('g1');

		act(() => {
			result.current.handlePostpone('g1');
		});

		expect(result.current.editingGuest?.guestId).toBe('g2');
	});

	it('handlePostpone closes modal when no more pending guests', async () => {
		const guest1 = makeGuest({
			guestId: 'g1',
			fullName: 'Guest A',
			deliveryStatus: 'generated',
		});
		const items = [guest1];
		const { result } = setupActions({ items });

		act(() => {
			result.current.openNextGeneratedGuest();
		});

		act(() => {
			result.current.handlePostpone('g1');
		});

		expect(result.current.modalOpen).toBe(false);
	});

	it.each([
		{ delivery: 'generated' as const, search: '', status: 'all' as const },
		{ delivery: 'shared' as const, search: '', status: 'all' as const },
		{ delivery: 'generated' as const, search: 'Test', status: 'all' as const },
		{ delivery: 'generated' as const, search: '', status: 'confirmed' as const },
	])(
		'passes delivery=$delivery with search=$search status=$status',
		async ({ delivery, search, status }) => {
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

			const { result } = renderHook(() =>
				useGuestDashboardRealtime({
					initialEventId: 'event-123',
					search,
					status,
					delivery,
				}),
			);

			await waitFor(() => {
				expect(result.current.items).toEqual([sampleGuest]);
			});

			expect(mockedGuestsApi.list).toHaveBeenCalledWith({
				eventId: 'event-123',
				search,
				status,
				delivery,
			});
		},
	);
});
