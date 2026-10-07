import { fireEvent, render, screen } from '@testing-library/react';
import GuestStatusOverview from '@/components/dashboard/guests/GuestStatusOverview';
import type { GuestStatusCounts } from '@/components/dashboard/guests/guest-presenter';

const counts: GuestStatusCounts = {
	total: 5,
	toSend: 2,
	waiting: 2,
	confirmed: 1,
	declined: 0,
	confirmedPeople: 3,
};

describe('GuestStatusOverview', () => {
	it('shows the plain-language summary and one segment per status', () => {
		render(
			<GuestStatusOverview counts={counts} activeFilter="all" onFilterChange={jest.fn()} />,
		);

		expect(screen.getByText('invitaciones por enviar')).toBeInTheDocument();
		expect(screen.getByText('1 ya confirmó.')).toBeInTheDocument();
		const group = screen.getByRole('group', { name: 'Mostrar' });
		expect(group.querySelectorAll('button')).toHaveLength(3);
		expect(screen.queryByRole('button', { name: /Ver todos/ })).not.toBeInTheDocument();
	});

	it('toggles a segment filter and offers a way back to all guests', () => {
		const onFilterChange = jest.fn();
		const { rerender } = render(
			<GuestStatusOverview
				counts={counts}
				activeFilter="all"
				onFilterChange={onFilterChange}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Esperando/ }));
		expect(onFilterChange).toHaveBeenLastCalledWith('confirmation-pending');

		rerender(
			<GuestStatusOverview
				counts={counts}
				activeFilter="confirmation-pending"
				onFilterChange={onFilterChange}
			/>,
		);
		expect(screen.getByRole('button', { name: /Esperando/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		fireEvent.click(screen.getByRole('button', { name: /Esperando/ }));
		expect(onFilterChange).toHaveBeenLastCalledWith('all');

		fireEvent.click(screen.getByRole('button', { name: 'Ver todos los invitados (5)' }));
		expect(onFilterChange).toHaveBeenLastCalledWith('all');
	});

	it('hides the segments when there are no guests yet', () => {
		render(
			<GuestStatusOverview
				counts={{ ...counts, total: 0, toSend: 0, waiting: 0, confirmed: 0 }}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		expect(screen.getByText('Todavía no tiene invitados')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'Mostrar' })).not.toBeInTheDocument();
	});
});

describe('GuestStatusOverview — optional segments', () => {
	it('adds reminder and message segments with the reminder hint when they apply', () => {
		const onFilterChange = jest.fn();
		render(
			<GuestStatusOverview
				counts={counts}
				activeFilter="all"
				onFilterChange={onFilterChange}
				reminderCount={2}
				withMessageCount={1}
				reminderHint="Faltan 10 días · 2 invitados sin confirmar"
			/>,
		);

		const group = screen.getByRole('group', { name: 'Mostrar' });
		expect(group.querySelectorAll('button')).toHaveLength(5);
		expect(screen.getByText('Faltan 10 días · 2 invitados sin confirmar')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Por recordar, 2' }));
		expect(onFilterChange).toHaveBeenLastCalledWith('reminder-pending');

		fireEvent.click(screen.getByRole('button', { name: 'Con mensaje, 1' }));
		expect(onFilterChange).toHaveBeenLastCalledWith('with-message');
	});

	it('omits the optional segments and hint when their counts are zero', () => {
		render(
			<GuestStatusOverview
				counts={counts}
				activeFilter="all"
				onFilterChange={jest.fn()}
				reminderCount={0}
				withMessageCount={0}
				reminderHint="Faltan 10 días"
			/>,
		);

		expect(screen.queryByRole('button', { name: /Por recordar/ })).not.toBeInTheDocument();
		expect(screen.queryByText('Faltan 10 días')).not.toBeInTheDocument();
	});
});
