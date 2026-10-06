import { fireEvent, render, screen } from '@testing-library/react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

jest.mock('@/components/dashboard/guests/SendInvitationModal', () => ({
	__esModule: true,
	default: ({
		onMarkShared,
		onReminderSent,
	}: {
		onMarkShared?: () => void;
		onReminderSent?: (guestId: string) => void;
	}) => (
		<div
			data-testid="send-invitation-modal"
			data-reminder-sent={onReminderSent ? 'wired' : ''}
			onClick={() => onMarkShared?.()}
		/>
	),
}));

describe('GuestCard status labels', () => {
	const baseProps = {
		index: 0,
		inviteUrl: 'https://example.com/invite/1',
		eventTitle: 'Test Event',
		shareTemplates: {
			invitation:
				'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
			reminder:
				'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
		},
		onMarkShared: jest.fn().mockResolvedValue(undefined),
		onOpenDetails: jest.fn(),
		shareDateContext: defaultShareDateContext(),
	};

	it('shows "Por enviar" when deliveryStatus is generated (not yet sent)', () => {
		render(
			<GuestCard
				item={makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' })}
				{...baseProps}
			/>,
		);
		expect(screen.getAllByText('Por enviar').length).toBeGreaterThanOrEqual(1);
	});

	it('shows "Por confirmar" when shared but not viewed and not yet confirmed', () => {
		render(
			<GuestCard
				item={makeGuest({
					deliveryStatus: 'shared',
					isViewed: false,
					attendanceStatus: 'pending',
				})}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Por confirmar')).toBeInTheDocument();
	});

	it('shows "Por confirmar" when shared and viewed but not yet confirmed', () => {
		render(
			<GuestCard
				item={makeGuest({
					deliveryStatus: 'shared',
					isViewed: true,
					attendanceStatus: 'pending',
				})}
				{...baseProps}
			/>,
		);
		expect(screen.getAllByText('Por confirmar').length).toBeGreaterThanOrEqual(1);
	});

	it('shows "Confirmada" when attendanceStatus is confirmed (overrides delivery status)', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'confirmed' })} {...baseProps} />);
		const labels = screen.getAllByText('Confirmada');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "No asiste" when attendanceStatus is declined', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'declined' })} {...baseProps} />);
		const labels = screen.getAllByText('No asiste');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows delivery status in header pill when attendanceStatus is pending', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'pending' })} {...baseProps} />);
		// Header shows delivery-driven status for pending guests
		expect(screen.getAllByText('Por enviar').length).toBeGreaterThanOrEqual(1);
	});

	it('renders metadata row with attendance', () => {
		render(
			<GuestCard
				item={makeGuest({ attendeeCount: 0, maxAllowedAttendees: 4 })}
				{...baseProps}
			/>,
		);
		expect(screen.getAllByText(/asistentes/).length).toBeGreaterThanOrEqual(1);
	});

	it('shows message tag when guest has a message', () => {
		render(
			<GuestCard
				item={makeGuest({ guestComment: 'Gracias por la invitacion' })}
				{...baseProps}
			/>,
		);
		const tag = screen.getByText('Mensaje');
		expect(tag).toBeInTheDocument();
		expect(tag.className).toContain('guest-tag--message');
	});

	it('does not show message tag when guest has no message', () => {
		render(<GuestCard item={makeGuest({ guestComment: '' })} {...baseProps} />);
		expect(screen.queryByText('Mensaje')).not.toBeInTheDocument();
		expect(screen.queryByText(/mensaje/i)).not.toBeInTheDocument();
	});

	it('shows "Copiar enlace" for confirmed guests (no dominant share CTA)', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('shows "Copiar enlace" for declined guests', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'declined', deliveryStatus: 'shared' })}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('shows "Recordar" for eligible confirmed guest in reminder mode', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				reminderMode={true}
				isReminderEligible={true}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Recordar')).toBeInTheDocument();
		expect(screen.queryByText('Copiar enlace')).not.toBeInTheDocument();
	});

	it('opens reminder modal when "Recordar" is clicked', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				reminderMode={true}
				isReminderEligible={true}
				{...baseProps}
			/>,
		);
		expect(screen.queryByTestId('send-invitation-modal')).not.toBeInTheDocument();
		fireEvent.click(screen.getByText('Recordar'));
		expect(screen.getByTestId('send-invitation-modal')).toBeInTheDocument();
	});

	it('shows "Copiar enlace" for confirmed guest in default mode (no reminder)', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				reminderMode={false}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('falls back to normal CTA when isReminderEligible changes from true to false', () => {
		const { rerender } = render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				reminderMode={true}
				isReminderEligible={true}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Recordar')).toBeInTheDocument();

		rerender(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				reminderMode={true}
				isReminderEligible={false}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('passes onReminderSent to SendInvitationModal when in reminder mode', () => {
		const onReminderSent = jest.fn();
		render(
			<GuestCard
				item={makeGuest({
					guestId: 'guest-42',
					attendanceStatus: 'confirmed',
					deliveryStatus: 'shared',
				})}
				reminderMode={true}
				isReminderEligible={true}
				onReminderSent={onReminderSent}
				{...baseProps}
			/>,
		);
		fireEvent.click(screen.getByText('Recordar'));
		const modal = screen.getByTestId('send-invitation-modal');
		expect(modal).toBeInTheDocument();
		expect(modal.getAttribute('data-reminder-sent')).toBe('wired');
	});
});

describe('GuestCard details', () => {
	it('opens the detail screen instead of expanding in place', () => {
		const onOpenDetails = jest.fn();
		const guest = makeGuest({ fullName: 'Familia Ruiz' });
		const { container } = render(
			<GuestCard
				item={guest}
				index={0}
				inviteUrl="https://example.com/invite/1"
				eventTitle="Test Event"
				shareTemplates={{ invitation: '{inviteUrl}', reminder: '{inviteUrl}' }}
				shareDateContext={defaultShareDateContext()}
				onMarkShared={jest.fn().mockResolvedValue(undefined)}
				onOpenDetails={onOpenDetails}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Familia Ruiz' }));
		expect(onOpenDetails).toHaveBeenCalledWith(guest);
		expect(container.querySelector('[aria-expanded]')).toBeNull();
	});
});
