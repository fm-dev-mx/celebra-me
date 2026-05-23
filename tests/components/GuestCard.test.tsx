import { render, screen } from '@testing-library/react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import { makeGuest } from '@tests/helpers/guest-factory';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

jest.mock('@/components/dashboard/guests/GuestExpandedActions', () => ({
	__esModule: true,
	default: () => <div data-testid="expanded-actions" />,
}));

describe('GuestCard status labels', () => {
	const baseProps = {
		index: 0,
		inviteUrl: 'https://example.com/invite/1',
		onEdit: jest.fn(),
		onDelete: jest.fn().mockResolvedValue(undefined),
		onMarkShared: jest.fn().mockResolvedValue(undefined),
	};

	it('shows "Por enviar" when deliveryStatus is generated (not yet sent)', () => {
		render(
			<GuestCard
				item={makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' })}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Por enviar')).toBeInTheDocument();
	});

	it('shows "Enviada" when shared but not viewed', () => {
		render(
			<GuestCard
				item={makeGuest({
					deliveryStatus: 'shared',
					isViewed: false,
					attendanceStatus: 'pending',
				})}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Enviada')).toBeInTheDocument();
	});

	it('shows "Recibida" when shared and viewed', () => {
		render(
			<GuestCard
				item={makeGuest({
					deliveryStatus: 'shared',
					isViewed: true,
					attendanceStatus: 'pending',
				})}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Recibida')).toBeInTheDocument();
	});

	it('shows "Aceptada" when attendanceStatus is confirmed (overrides delivery status)', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'confirmed' })} {...baseProps} />);
		// The status label appears in the status pill header AND in the expanded RSVP detail.
		// getAllByText ensures we find at least one occurrence.
		const labels = screen.getAllByText('Aceptada');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "Denegada" when attendanceStatus is declined', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'declined' })} {...baseProps} />);
		const labels = screen.getAllByText('Denegada');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});
});
