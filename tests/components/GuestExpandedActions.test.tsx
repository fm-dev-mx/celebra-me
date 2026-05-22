import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';

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
	guestComment: '',
	deliveryStatus: 'generated',
	viewPercentage: 0,
	isViewed: false,
	firstViewedAt: null,
	respondedAt: null,
	waShareUrl: 'https://wa.me/123',
	shareText: 'Share text',
	updatedAt: '2026-03-22T00:00:00.000Z',
};

describe('guest dashboard expanded actions', () => {
	const sentGuest: DashboardGuestItem = {
		...sampleGuest,
		deliveryStatus: 'shared',
	};
	const onEdit = jest.fn();
	const onDelete = jest.fn().mockResolvedValue(undefined);
	const onMarkShared = jest.fn().mockResolvedValue(undefined);
	const onRevertShared = jest.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: jest.fn().mockResolvedValue(undefined) },
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('shows Marcar como enviada when guest is not yet sent', () => {
		render(
			<GuestExpandedActions
				guestName={sampleGuest.fullName}
				inviteUrl="https://example.com/invite/1"
				isShared={false}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
			/>,
		);
		expect(screen.getByText('Marcar como enviada')).toBeInTheDocument();
		expect(screen.queryByText('Marcar como no enviada')).not.toBeInTheDocument();
	});

	it('shows Marcar como no enviada when guest is already sent', () => {
		render(
			<GuestExpandedActions
				guestName={sentGuest.fullName}
				inviteUrl="https://example.com/invite/2"
				isShared={true}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
				onRevertShared={onRevertShared}
			/>,
		);
		expect(screen.getByText('Marcar como no enviada')).toBeInTheDocument();
		expect(screen.queryByText('Marcar como enviada')).not.toBeInTheDocument();
	});

	it('first click on Marcar como enviada does not call onMarkShared', () => {
		render(
			<GuestExpandedActions
				guestName={sampleGuest.fullName}
				inviteUrl="https://example.com/invite/1"
				isShared={false}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
			/>,
		);

		fireEvent.click(screen.getByText('Marcar como enviada'));
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(screen.getByText('Click para confirmar')).toBeInTheDocument();
	});

	it('second click on Click para confirmar calls onMarkShared', async () => {
		render(
			<GuestExpandedActions
				guestName={sampleGuest.fullName}
				inviteUrl="https://example.com/invite/1"
				isShared={false}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
			/>,
		);

		fireEvent.click(screen.getByText('Marcar como enviada'));
		fireEvent.click(screen.getByText('Click para confirmar'));
		await waitFor(() => {
			expect(onMarkShared).toHaveBeenCalledTimes(1);
		});
	});

	it('first click on Marcar como no enviada does not call onRevertShared', () => {
		render(
			<GuestExpandedActions
				guestName={sentGuest.fullName}
				inviteUrl="https://example.com/invite/2"
				isShared={true}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
				onRevertShared={onRevertShared}
			/>,
		);

		fireEvent.click(screen.getByText('Marcar como no enviada'));
		expect(onRevertShared).not.toHaveBeenCalled();
		expect(screen.getByText('Click para confirmar')).toBeInTheDocument();
	});

	it('second click on Click para confirmar calls onRevertShared', async () => {
		render(
			<GuestExpandedActions
				guestName={sentGuest.fullName}
				inviteUrl="https://example.com/invite/2"
				isShared={true}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
				onRevertShared={onRevertShared}
			/>,
		);

		fireEvent.click(screen.getByText('Marcar como no enviada'));
		fireEvent.click(screen.getByText('Click para confirmar'));
		await waitFor(() => {
			expect(onRevertShared).toHaveBeenCalledTimes(1);
		});
	});

	it('shows correction copy for accepted guest on mark-sent button', () => {
		render(
			<GuestExpandedActions
				guestName={sampleGuest.fullName}
				inviteUrl="https://example.com/invite/1"
				isShared={false}
				attendanceStatus="confirmed"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
			/>,
		);
		expect(
			screen.getByText('Esto no cambiará la confirmación de asistencia.'),
		).toBeInTheDocument();
	});

	it('shows correction copy for accepted guest on revert button', () => {
		render(
			<GuestExpandedActions
				guestName={sentGuest.fullName}
				inviteUrl="https://example.com/invite/2"
				isShared={true}
				attendanceStatus="confirmed"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
				onRevertShared={onRevertShared}
			/>,
		);
		expect(
			screen.getByText('Esto no cambiará la confirmación de asistencia.'),
		).toBeInTheDocument();
	});

	it('does not show correction copy for pending guest', () => {
		render(
			<GuestExpandedActions
				guestName={sampleGuest.fullName}
				inviteUrl="https://example.com/invite/1"
				isShared={false}
				attendanceStatus="pending"
				onEdit={onEdit}
				onDelete={onDelete}
				onMarkShared={onMarkShared}
			/>,
		);
		expect(
			screen.queryByText('Esto no cambiará la confirmación de asistencia.'),
		).not.toBeInTheDocument();
	});
});
