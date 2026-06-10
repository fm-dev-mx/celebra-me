import { fireEvent, render, screen } from '@testing-library/react';
import GuestDashboardApp from '@/components/dashboard/guests/GuestDashboardApp';
import { useGuestDashboardActions } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import { useGuestDashboardRealtime } from '@/components/dashboard/guests/use-guest-dashboard-realtime';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	defaultShareDateContext,
	DEFAULT_REMINDER_SETTINGS_FIXTURE,
} from '@tests/helpers/test-fixtures';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
} from '@/lib/rsvp/services/shared/share-message-defaults';

jest.mock('@/components/dashboard/guests/use-guest-dashboard-realtime', () => ({
	useGuestDashboardRealtime: jest.fn(),
}));

jest.mock('@/components/dashboard/guests/use-guest-dashboard-actions', () => ({
	useGuestDashboardActions: jest.fn(),
}));

const mockedUseGuestDashboardRealtime = useGuestDashboardRealtime as jest.MockedFunction<
	typeof useGuestDashboardRealtime
>;
const mockedUseGuestDashboardActions = useGuestDashboardActions as jest.MockedFunction<
	typeof useGuestDashboardActions
>;

const guests = [
	makeGuest({
		guestId: 'guest-delivery',
		fullName: 'Delivery Pending Guest',
		deliveryStatus: 'generated',
		attendanceStatus: 'confirmed',
		guestComment: '',
	}),
	makeGuest({
		guestId: 'guest-rsvp',
		fullName: 'RSVP Pending Guest',
		deliveryStatus: 'shared',
		attendanceStatus: 'pending',
		guestComment: '',
	}),
	makeGuest({
		guestId: 'guest-message',
		fullName: 'Message Guest',
		deliveryStatus: 'shared',
		attendanceStatus: 'confirmed',
		guestComment: 'Gracias por invitarme',
	}),
];

const totals = {
	totalInvitations: guests.length,
	totalPeople: 12,
	generatedInvitations: 1,
	sharedInvitations: 2,
	pendingInvitations: 1,
	pendingPeople: 4,
	confirmedInvitations: 2,
	confirmedPeople: 2,
	declinedInvitations: 0,
	declinedPeople: 0,
	unconfirmedShared: 0,
	viewed: 0,
};

function setupDashboard() {
	mockedUseGuestDashboardRealtime.mockReturnValue({
		error: '',
		eventId: 'event-1',
		hostEvents: [
			{
				id: 'event-1',
				title: 'Evento',
				slug: 'evento',
				eventType: 'xv',
			},
		],
		inviteBaseUrl: 'https://example.com',
		items: guests,
		loading: false,
		loadGuests: jest.fn(),
		realtimeState: 'connected',
		setEventId: jest.fn(),
		setItems: jest.fn(),
		setShareTemplates: jest.fn(),
		setReminderSettings: jest.fn(),
		totals,
		shareTemplates: {
			invitation: DEFAULT_INVITATION_MESSAGE,
			reminder: DEFAULT_REMINDER_MESSAGE,
		},
		reminderSettings: DEFAULT_REMINDER_SETTINGS_FIXTURE,
		shareDateContext: defaultShareDateContext(),
		updatedAt: '2026-05-24T00:00:00.000Z',
	});

	mockedUseGuestDashboardActions.mockReturnValue({
		batchFlowKind: 'invitation',
		celebratingGuestId: null,
		closeDeleteConfirm: jest.fn(),
		closeModal: jest.fn(),
		deleteConfirmOpen: false,
		editFirstGuestShortcut: jest.fn(),
		editingGuest: null,
		guestToDelete: null,
		handleAdvanceFromGuest: jest.fn(),
		handleDeleteConfirm: jest.fn(),
		handleExport: jest.fn(),
		handleImport: jest.fn(),
		handleImportUpdate: jest.fn(),
		handleMarkShared: jest.fn(),
		handlePostpone: jest.fn(),
		handleRevertShared: jest.fn(),
		handleSaveInvitation: jest.fn(),
		handleSubmit: jest.fn(),
		handleToggleBrandingRemoval: jest.fn(),
		importModalOpen: false,
		isNextActionActive: false,
		modalMode: 'create',
		modalOpen: false,
		notification: null,
		openCreateModal: jest.fn(),
		openEditModal: jest.fn(),
		openImportModal: jest.fn(),
		openNextGeneratedGuest: jest.fn(),
		openNextReminderGuest: jest.fn(),
		pendingGuests: guests.filter((item) => item.deliveryStatus === 'generated'),
		requestDelete: jest.fn(),
		setImportModalOpen: jest.fn(),
		setNotification: jest.fn(),
	});
}

function expectVisibleGuestNames(names: string[]) {
	for (const guest of guests) {
		const matcher = names.includes(guest.fullName) ? expect.any(Array) : [];
		const matches = screen.queryAllByText(guest.fullName);
		if (Array.isArray(matcher)) {
			expect(matches).toHaveLength(0);
		} else {
			expect(matches.length).toBeGreaterThan(0);
		}
	}
}

describe('GuestDashboardApp review filters', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setupDashboard();
	});

	it('filters visible guests by pending delivery and restores all with Todos', () => {
		render(<GuestDashboardApp initialEventId="event-1" />);

		fireEvent.click(screen.getByRole('button', { name: 'Por enviar, 1' }));
		expectVisibleGuestNames(['Delivery Pending Guest']);
		expect(screen.getByRole('button', { name: 'Por enviar, 1' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
		expectVisibleGuestNames(['Delivery Pending Guest', 'RSVP Pending Guest', 'Message Guest']);
	});

	it('filters visible guests by pending RSVP', () => {
		render(<GuestDashboardApp initialEventId="event-1" />);

		fireEvent.click(screen.getByRole('button', { name: 'Sin respuesta, 1' }));

		expectVisibleGuestNames(['RSVP Pending Guest']);
	});

	it('filters visible guests by existing guest message', () => {
		render(<GuestDashboardApp initialEventId="event-1" />);

		fireEvent.click(screen.getByRole('button', { name: 'Con mensaje, 1' }));

		expectVisibleGuestNames(['Message Guest']);
	});
});
