import { act, fireEvent, render, screen } from '@testing-library/react';
import GuestStatusOverview from '@/components/dashboard/guests/GuestStatusOverview';
import { computeGuestSummary } from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const summary = computeGuestSummary([
	makeGuest({ guestId: 'a', deliveryStatus: 'generated', maxAllowedAttendees: 2 }),
	makeGuest({ guestId: 'b', deliveryStatus: 'shared', maxAllowedAttendees: 3 }),
	makeGuest({ guestId: 'c', deliveryStatus: 'shared', isViewed: true, maxAllowedAttendees: 4 }),
	makeGuest({
		guestId: 'd',
		deliveryStatus: 'shared',
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 4,
		attendeeCount: 3,
	}),
	makeGuest({
		guestId: 'e',
		deliveryStatus: 'shared',
		attendanceStatus: 'declined',
		maxAllowedAttendees: 2,
	}),
]);

describe('GuestStatusOverview', () => {
	it('leads with confirmed people out of assigned passes', () => {
		render(
			<GuestStatusOverview summary={summary} activeFilter="all" onFilterChange={jest.fn()} />,
		);

		expect(screen.getByRole('heading', { name: 'Personas confirmadas' })).toBeInTheDocument();
		expect(screen.getByText('de 15 pases · 20 %')).toBeInTheDocument();
		expect(
			screen.getByRole('img', {
				name: 'De 15 pases. Confirmadas: 3, No asistirán: 2, Lugares no usados: 1, Sin respuesta: 9',
			}),
		).toBeInTheDocument();
	});

	it('shows four invitation stages that toggle the list filter', () => {
		const onFilterChange = jest.fn();
		const { rerender } = render(
			<GuestStatusOverview
				summary={summary}
				activeFilter="all"
				onFilterChange={onFilterChange}
			/>,
		);

		const group = screen.getByRole('group', { name: 'Filtrar invitaciones por etapa' });
		expect(group.querySelectorAll('button')).toHaveLength(4);
		expect(screen.getByRole('button', { name: 'Respondidas, 2' })).toHaveTextContent(
			'1 sí · 1 no',
		);

		fireEvent.click(screen.getByRole('button', { name: 'Abiertas, sin responder, 1' }));
		expect(onFilterChange).toHaveBeenLastCalledWith('opened');

		rerender(
			<GuestStatusOverview
				summary={summary}
				activeFilter="opened"
				onFilterChange={onFilterChange}
			/>,
		);
		const opened = screen.getByRole('button', { name: 'Abiertas, sin responder, 1' });
		expect(opened).toHaveAttribute('aria-pressed', 'true');
		fireEvent.click(opened);
		expect(onFilterChange).toHaveBeenLastCalledWith('all');
	});

	it('offers the reminder as the next step when reminders apply', () => {
		const onRemind = jest.fn();
		render(
			<GuestStatusOverview
				summary={summary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				reminderCount={2}
				reminderHint="Faltan 10 días · 2 invitados sin confirmar"
				withMessageCount={1}
				onRemind={onRemind}
			/>,
		);

		expect(screen.getByText(/sin respuesta \(7 pases\)/)).toBeInTheDocument();
		expect(screen.getByText('Faltan 10 días · 2 invitados sin confirmar')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Recordar por WhatsApp' }));
		expect(onRemind).toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Por recordar, 2' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Con mensaje, 1' })).toBeInTheDocument();
	});

	it('suggests sending pending invitations when no reminder applies', () => {
		const onSendPending = jest.fn();
		render(
			<GuestStatusOverview
				summary={summary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				onSendPending={onSendPending}
			/>,
		);

		expect(screen.queryByRole('button', { name: /Por recordar/ })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Enviar invitaciones' }));
		expect(onSendPending).toHaveBeenCalled();
	});

	it('shows the RSVP deadline and copies a shareable summary', async () => {
		const writeText = jest.fn().mockResolvedValue(undefined);
		Object.assign(navigator, { clipboard: { writeText } });
		render(
			<GuestStatusOverview
				summary={summary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				rsvpDeadline="15 de noviembre"
				eventTitle="Boda"
			/>,
		);

		expect(screen.getByText('15 de noviembre')).toBeInTheDocument();
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Compartir resumen' }));
		});
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining('3 personas confirmadas'));
		expect(screen.getByText('Resumen copiado')).toBeInTheDocument();
	});

	it('guides the host when there are no invitations yet', () => {
		render(
			<GuestStatusOverview
				summary={computeGuestSummary([])}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		expect(screen.getByText('Todavía no tiene invitaciones')).toBeInTheDocument();
		expect(
			screen.queryByRole('group', { name: 'Filtrar invitaciones por etapa' }),
		).not.toBeInTheDocument();
	});
});
