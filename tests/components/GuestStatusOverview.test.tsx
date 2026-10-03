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
