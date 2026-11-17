import { act, fireEvent, render, screen, within } from '@testing-library/react';
import GuestStatusOverview from '@/components/dashboard/guests/GuestStatusOverview';
import { computeGuestSummary } from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const guests = [
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
];
const summary = computeGuestSummary(guests);
// Everyone has their invitation, so the next step is the reminder.
const sentSummary = computeGuestSummary(guests.filter((guest) => guest.guestId !== 'a'));

describe('GuestStatusOverview', () => {
	it('shows adult and child counts for every category without changing its total', () => {
		const familySummary = computeGuestSummary([
			makeGuest({ maxAllowedAttendees: 5, maxAllowedChildren: 2 }),
			makeGuest({ deliveryStatus: 'shared', maxAllowedAttendees: 4, maxAllowedChildren: 1 }),
			makeGuest({
				deliveryStatus: 'shared',
				isViewed: true,
				maxAllowedAttendees: 3,
				maxAllowedChildren: 2,
			}),
			makeGuest({
				attendanceStatus: 'declined',
				maxAllowedAttendees: 6,
				maxAllowedChildren: 2,
			}),
			makeGuest({
				attendanceStatus: 'confirmed',
				maxAllowedAttendees: 5,
				maxAllowedChildren: 3,
				attendeeCount: 4,
				childrenCount: 1,
			}),
		]);
		render(
			<GuestStatusOverview
				summary={familySummary}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);
		expect(screen.getByText('de 23 pases · 17 %')).toBeInTheDocument();
		const breakdown = screen
			.getByText('Pases', { selector: 'dt' })
			.closest('dl') as HTMLElement;
		expect(within(breakdown).getByText('13 adultos y 10 niños')).toBeInTheDocument();
		expect(within(breakdown).getByText('3 adultos y 1 niño')).toBeInTheDocument();
		const legendItem = (label: string) =>
			screen
				.getAllByText(label)
				.map((el) => el.closest('li.guest-overview__legend-item'))
				.find(Boolean);
		expect(legendItem('Confirmadas')).toHaveTextContent('Confirmadas43 adultos y 1 niño');
		expect(legendItem('No asistirán')).toHaveTextContent('No asistirán64 adultos y 2 niños');
		expect(legendItem('Sin respuesta')).toHaveTextContent('Sin respuesta127 adultos y 5 niños');
		expect(screen.getByRole('button', { name: 'Por enviar, 1' })).toHaveTextContent(
			'5 invitados3 adultos y 2 niños',
		);
		expect(screen.getByRole('button', { name: 'Enviadas, sin abrir, 1' })).toHaveTextContent(
			'4 invitados3 adultos y 1 niño',
		);
		expect(
			screen.getByRole('button', { name: 'Abiertas, sin responder, 1' }),
		).toHaveTextContent('3 invitados1 adulto y 2 niños');
	});

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

	it('breaks the confirmed people into adults and children when children are coming', () => {
		const withChildren = computeGuestSummary([
			makeGuest({
				attendanceStatus: 'confirmed',
				maxAllowedAttendees: 3,
				maxAllowedChildren: 1,
				attendeeCount: 3,
				childrenCount: 1,
			}),
		]);
		render(
			<GuestStatusOverview
				summary={withChildren}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		const breakdown = screen.getByText('Confirmadas', { selector: 'dt' }).closest('dl');
		expect(breakdown).toHaveTextContent('Confirmadas2 adultos y 1 niño');
	});

	it('omits the adults and children line when no children are confirmed', () => {
		render(
			<GuestStatusOverview summary={summary} activeFilter="all" onFilterChange={jest.fn()} />,
		);

		expect(screen.queryByText(/adulto|niño/)).not.toBeInTheDocument();
		expect(document.querySelector('.guest-overview__breakdown')).toBeNull();
		expect(document.querySelector('.guest-overview__legend-detail')).toBeNull();
		expect(document.querySelector('.guest-overview__stage-party')).toBeNull();
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
				summary={sentSummary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				reminderCount={2}
				reminderHint="Faltan 10 días · 2 invitados sin confirmar"
				onRemind={onRemind}
			/>,
		);

		expect(screen.getByText(/2 invitaciones enviadas sin confirmar/)).toBeInTheDocument();
		expect(screen.getByText('Faltan 10 días · 2 invitados sin confirmar')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Recordar por WhatsApp' }));
		expect(onRemind).toHaveBeenCalled();
	});

	it('explains when the reminder reaches more invitations than the unanswered ones', () => {
		render(
			<GuestStatusOverview
				summary={sentSummary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				reminderCount={3}
				onRemind={jest.fn()}
			/>,
		);

		expect(
			screen.getByText('El recordatorio llegará a 3 invitaciones según su configuración.'),
		).toBeInTheDocument();
	});

	it('scopes the next step to the selected group', () => {
		const groupSummary = computeGuestSummary([
			makeGuest({ guestId: 'f1', deliveryStatus: 'shared', maxAllowedAttendees: 3 }),
		]);
		render(
			<GuestStatusOverview
				summary={summary}
				activeFilter="all"
				onFilterChange={jest.fn()}
				reminderCount={2}
				nextStepScope={{ label: 'Familia', summary: groupSummary, reminderCount: 1 }}
				onRemind={jest.fn()}
			/>,
		);

		expect(screen.getByText(/Familia: 1 invitación enviada sin confirmar/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Recordar a 1 de Familia' })).toBeInTheDocument();
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
			fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
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
