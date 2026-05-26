import { fireEvent, render, screen } from '@testing-library/react';
import GuestFilters from '@/components/dashboard/guests/GuestFilters';

describe('GuestFilters — group filter', () => {
	const baseProps = {
		search: '',
		status: 'all' as const,
		delivery: 'all' as const,
		group: 'all' as const,
		onSearchChange: jest.fn(),
		onStatusChange: jest.fn(),
		onDeliveryChange: jest.fn(),
		onGroupChange: jest.fn(),
	};

	it('renders group select with all predefined options', () => {
		render(<GuestFilters {...baseProps} />);

		const select = screen.getByLabelText('Grupo');
		expect(select).toBeInTheDocument();

		const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
		expect(options).toContain('Todos');
		expect(options).toContain('Familia');
		expect(options).toContain('Amigos');
		expect(options).toContain('VIP');
		expect(options).toContain('Trabajo');
	});

	it('calls onGroupChange when a group is selected', () => {
		const onGroupChange = jest.fn();
		render(<GuestFilters {...baseProps} onGroupChange={onGroupChange} />);

		fireEvent.change(screen.getByLabelText('Grupo'), {
			target: { value: 'VIP' },
		});
		expect(onGroupChange).toHaveBeenCalledWith('VIP');
	});

	it('clears group filter when clear button is clicked', () => {
		const onGroupChange = jest.fn();
		render(<GuestFilters {...baseProps} group="Familia" onGroupChange={onGroupChange} />);

		fireEvent.click(screen.getByText('Limpiar filtros'));
		expect(onGroupChange).toHaveBeenCalledWith('all');
	});

	it('shows active indicator when a group filter is selected', () => {
		render(<GuestFilters {...baseProps} group="Amigos" />);
		expect(screen.getByLabelText('Filtros activos')).toBeInTheDocument();
	});

	it('shows advanced filters when a group filter is active', () => {
		render(<GuestFilters {...baseProps} group="Trabajo" />);
		expect(screen.getByDisplayValue('Trabajo')).toBeInTheDocument();
	});
});
