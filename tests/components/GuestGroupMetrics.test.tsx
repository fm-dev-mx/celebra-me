import { fireEvent, render, screen } from '@testing-library/react';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import { computeGroupMetrics } from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const metrics = computeGroupMetrics([
	makeGuest({ guestId: '1', tags: ['Familia'], maxAllowedAttendees: 4 }),
	makeGuest({
		guestId: '2',
		tags: ['Familia'],
		attendanceStatus: 'confirmed',
		maxAllowedAttendees: 2,
		attendeeCount: 2,
	}),
	makeGuest({ guestId: '3', tags: [], attendanceStatus: 'confirmed', attendeeCount: 4 }),
]);

describe('GuestGroupMetrics', () => {
	it('shows confirmed people of assigned passes per group, "Sin grupo" last', () => {
		render(<GuestGroupMetrics metrics={metrics} activeGroup="all" onSelectGroup={jest.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: /Por grupo/ }));
		const rows = screen.getAllByRole('button', { pressed: false });
		expect(rows[0]).toHaveTextContent('Familia2 de 6');
		expect(rows[0]).toHaveTextContent('4 sin respuesta');
		expect(rows[1]).toHaveTextContent('Sin grupo4 de 4');
		expect(rows[1]).toHaveTextContent('Todos respondieron');
	});

	it('filters the list by tapping a group, and clears on a second tap', () => {
		const onSelectGroup = jest.fn();
		const { rerender } = render(
			<GuestGroupMetrics metrics={metrics} activeGroup="all" onSelectGroup={onSelectGroup} />,
		);
		fireEvent.click(screen.getByRole('button', { name: /Por grupo/ }));
		fireEvent.click(screen.getByRole('button', { name: /^Familia/ }));
		expect(onSelectGroup).toHaveBeenLastCalledWith('Familia');

		rerender(
			<GuestGroupMetrics
				metrics={metrics}
				activeGroup="Familia"
				onSelectGroup={onSelectGroup}
			/>,
		);
		fireEvent.click(screen.getByRole('button', { name: /^Familia/ }));
		expect(onSelectGroup).toHaveBeenLastCalledWith('all');
	});

	it('renders nothing when groups are not in use', () => {
		const { container } = render(
			<GuestGroupMetrics
				metrics={computeGroupMetrics([makeGuest({ tags: [] })])}
				activeGroup="all"
				onSelectGroup={jest.fn()}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});
});
