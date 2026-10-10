import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('GuestFilters — group chips', () => {
	const baseProps = {
		search: '',
		group: 'all',
		groupMetrics,
		totalInvitations: 4,
		onSearchChange: jest.fn(),
		onGroupChange: jest.fn(),
	};

	it('shows one chip per group with counts, plus "Todos" and "Sin grupo"', () => {
		render(<GuestFilters {...baseProps} />);

		const chips = within(screen.getByRole('group', { name: 'Grupo' })).getAllByRole('button');
		expect(chips.map((chip) => chip.textContent)).toEqual([
			'Todos4',
			'Familia2',
			'VIP1',
			'Sin grupo1',
		]);
		expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
	});

	it('selects a group and toggles back to all', () => {
		const onGroupChange = jest.fn();
		const { rerender } = render(<GuestFilters {...baseProps} onGroupChange={onGroupChange} />);

		fireEvent.click(screen.getByRole('button', { name: /^Sin grupo/ }));
		expect(onGroupChange).toHaveBeenLastCalledWith(NO_GROUP_FILTER);

		rerender(<GuestFilters {...baseProps} group="VIP" onGroupChange={onGroupChange} />);
		fireEvent.click(screen.getByRole('button', { name: /^VIP/ }));
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
