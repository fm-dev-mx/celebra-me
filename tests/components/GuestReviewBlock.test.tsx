import { fireEvent, render, screen } from '@testing-library/react';
import GuestReviewBlock from '@/components/dashboard/guests/GuestReviewBlock';
import { makeGuest } from '@tests/helpers/guest-factory';

describe('GuestReviewBlock', () => {
	it('renders only non-zero review chips derived from guest items', () => {
		render(
			<GuestReviewBlock
				items={[
					makeGuest({
						guestId: 'guest-1',
						deliveryStatus: 'generated',
						attendanceStatus: 'pending',
						phone: '',
						guestComment: '',
					}),
					makeGuest({
						guestId: 'guest-2',
						deliveryStatus: 'shared',
						attendanceStatus: 'confirmed',
						phone: '6691234567',
						guestComment: 'Nos vemos pronto',
					}),
				]}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		expect(screen.getByText('Revisar')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Por enviar, 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sin respuesta, 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Con mensaje, 1' })).toBeInTheDocument();
		expect(screen.queryByText('Sin teléfono')).not.toBeInTheDocument();
	});

	it('does not render when there are no review items', () => {
		const { container } = render(
			<GuestReviewBlock
				items={[
					makeGuest({
						deliveryStatus: 'shared',
						attendanceStatus: 'confirmed',
						phone: '6691234567',
						guestComment: '',
					}),
				]}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		expect(screen.queryByText('Revisar')).not.toBeInTheDocument();
		expect(container).toBeEmptyDOMElement();
	});

	it('renders Con mensaje when at least one guest has a guestComment', () => {
		render(
			<GuestReviewBlock
				items={[
					makeGuest({
						deliveryStatus: 'shared',
						attendanceStatus: 'confirmed',
						guestComment: 'Gracias por invitarme',
					}),
				]}
				activeFilter="all"
				onFilterChange={jest.fn()}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Con mensaje, 1' })).toBeInTheDocument();
	});

	it('marks the active chip accessibly and visually', () => {
		render(
			<GuestReviewBlock
				items={[makeGuest({ deliveryStatus: 'generated' })]}
				activeFilter="delivery-pending"
				onFilterChange={jest.fn()}
			/>,
		);

		const chip = screen.getByRole('button', { name: 'Por enviar, 1' });
		expect(chip).toHaveAttribute('aria-pressed', 'true');
		expect(chip).toHaveClass('guest-review__chip--active');
	});

	it('notifies when a chip is clicked and clears when the active chip is clicked again', () => {
		const onFilterChange = jest.fn();
		const { rerender } = render(
			<GuestReviewBlock
				items={[makeGuest({ deliveryStatus: 'generated' })]}
				activeFilter="all"
				onFilterChange={onFilterChange}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Por enviar, 1' }));
		expect(onFilterChange).toHaveBeenCalledWith('delivery-pending');

		rerender(
			<GuestReviewBlock
				items={[makeGuest({ deliveryStatus: 'generated' })]}
				activeFilter="delivery-pending"
				onFilterChange={onFilterChange}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Por enviar, 1' }));
		expect(onFilterChange).toHaveBeenCalledWith('all');
	});
});
