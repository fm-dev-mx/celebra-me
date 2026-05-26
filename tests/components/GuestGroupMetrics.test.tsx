import { render, screen } from '@testing-library/react';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import { makeGuest } from '@tests/helpers/guest-factory';

describe('GuestGroupMetrics', () => {
	it('renders per-group totals and pending counts', () => {
		const { container } = render(
			<GuestGroupMetrics
				items={[
					makeGuest({ guestId: '1', tags: ['Familia'], attendanceStatus: 'pending' }),
					makeGuest({ guestId: '2', tags: ['Familia'], attendanceStatus: 'confirmed' }),
					makeGuest({ guestId: '3', tags: ['VIP'], attendanceStatus: 'pending' }),
				]}
			/>,
		);

		expect(screen.getByText('Familia')).toBeInTheDocument();
		expect(screen.getByText('VIP')).toBeInTheDocument();
		const countEls = container.querySelectorAll('.guest-group-metrics__count');
		expect(countEls[0]).toHaveTextContent('2 invitaciones');
		expect(countEls[1]).toHaveTextContent('1 invitación');
		expect(container.querySelector('.guest-group-metrics__pending')).toHaveTextContent(
			'1 pendiente',
		);
	});

	it('renders nothing when items list is empty', () => {
		const { container } = render(<GuestGroupMetrics items={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it('includes "Sin grupo" for guests with no tags', () => {
		const { container } = render(
			<GuestGroupMetrics
				items={[
					makeGuest({ guestId: '1', tags: [] }),
					makeGuest({ guestId: '2', tags: ['system:public'] }),
				]}
			/>,
		);

		expect(screen.getByText('Sin grupo')).toBeInTheDocument();
		expect(container.querySelector('.guest-group-metrics__count')).toHaveTextContent(
			'2 invitaciones',
		);
	});

	it('does not show pending count when none are pending', () => {
		const { container } = render(
			<GuestGroupMetrics
				items={[
					makeGuest({
						guestId: '1',
						tags: ['VIP'],
						attendanceStatus: 'confirmed',
					}),
				]}
			/>,
		);

		expect(screen.getByText('VIP')).toBeInTheDocument();
		expect(container.querySelector('.guest-group-metrics__count')).toHaveTextContent(
			'1 invitación',
		);
		expect(container.querySelector('.guest-group-metrics__pending')).toBeNull();
	});
});
