import { fireEvent, render, screen } from '@testing-library/react';
import GuestFilters from '@/components/dashboard/guests/GuestFilters';
import {
	computeGroupMetrics,
	NO_GROUP_FILTER,
} from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const groupMetrics = computeGroupMetrics([
	makeGuest({ guestId: '1', tags: ['Familia'] }),
	makeGuest({ guestId: '2', tags: ['Familia'] }),
	makeGuest({ guestId: '3', tags: ['VIP'] }),
	makeGuest({ guestId: '4', tags: [] }),
]);

describe('GuestFilters — group select', () => {
	const baseProps = {
		search: '',
		group: 'all',
		groupMetrics,
		totalInvitations: 4,
		onSearchChange: jest.fn(),
		onGroupChange: jest.fn(),
	};

	it('offers one option per group with counts, plus "Todos" and "Sin grupo"', () => {
		render(<GuestFilters {...baseProps} />);

		const select = screen.getByLabelText('Grupo') as HTMLSelectElement;
		expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
			'Todos (4)',
			'Familia (2)',
			'VIP (1)',
			'Sin grupo (1)',
		]);
		expect(select).toHaveValue('all');
	});

	it('selects a group and back to all', () => {
		const onGroupChange = jest.fn();
		const { rerender } = render(<GuestFilters {...baseProps} onGroupChange={onGroupChange} />);

		fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: NO_GROUP_FILTER } });
		expect(onGroupChange).toHaveBeenLastCalledWith(NO_GROUP_FILTER);

		rerender(<GuestFilters {...baseProps} group="VIP" onGroupChange={onGroupChange} />);
		fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: 'all' } });
		expect(onGroupChange).toHaveBeenLastCalledWith('all');
	});

	it('clears the search together with the group', () => {
		const onSearchChange = jest.fn();
		const onGroupChange = jest.fn();
		render(
			<GuestFilters
				{...baseProps}
				search="Ana"
				group="Familia"
				onSearchChange={onSearchChange}
				onGroupChange={onGroupChange}
			/>,
		);
		fireEvent.click(screen.getByText('Limpiar filtros'));
		expect(onSearchChange).toHaveBeenCalledWith('');
		expect(onGroupChange).toHaveBeenCalledWith('all');
	});

	it('offers no status selects: stages live in the overview', () => {
		render(<GuestFilters {...baseProps} />);
		expect(screen.queryByLabelText('Filtro')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Entrega')).not.toBeInTheDocument();
	});
});
