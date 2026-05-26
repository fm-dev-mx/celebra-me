import { render, screen } from '@testing-library/react';
import GuestTableRow from '@/components/dashboard/guests/GuestTableRow';
import { makeGuest } from '@tests/helpers/guest-factory';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

jest.mock('@/components/dashboard/guests/GuestExpandedActions', () => ({
	__esModule: true,
	default: () => <div data-testid="expanded-actions" />,
}));

describe('GuestTableRow — % Vista column', () => {
	const baseProps = {
		index: 0,
		inviteUrl: 'https://example.com/invite/1',
		onEdit: jest.fn(),
		onDelete: jest.fn().mockResolvedValue(undefined),
		onMarkShared: jest.fn().mockResolvedValue(undefined),
	};

	const renderRow = (overrides: Partial<DashboardGuestItem> = {}) =>
		render(
			<table>
				<tbody>
					<GuestTableRow item={makeGuest(overrides)} {...baseProps} />
				</tbody>
			</table>,
		);

	it('renders numeric percentage label for 0%', () => {
		renderRow({ isViewed: true, viewPercentage: 0 });
		expect(screen.getByText('0%')).toBeInTheDocument();
	});

	it('renders numeric percentage label for 42%', () => {
		renderRow({ isViewed: true, viewPercentage: 42 });
		expect(screen.getByText('42%')).toBeInTheDocument();
	});

	it('renders numeric percentage label for 100%', () => {
		renderRow({ isViewed: true, viewPercentage: 100 });
		expect(screen.getByText('100%')).toBeInTheDocument();
	});

	it('assigns correct inline-size style to the progress fill', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: 67 });
		const fill = container.querySelector<HTMLElement>('.engagement-mini__progress');
		expect(fill).toBeInTheDocument();
		expect(fill).toHaveStyle({ inlineSize: '67%' });
	});

	it('assigns inline-size 0% when percentage is 0', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: 0 });
		const fill = container.querySelector<HTMLElement>('.engagement-mini__progress');
		expect(fill).toHaveStyle({ inlineSize: '0%' });
	});

	it('assigns inline-size 100% when percentage is 100', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: 100 });
		const fill = container.querySelector<HTMLElement>('.engagement-mini__progress');
		expect(fill).toHaveStyle({ inlineSize: '100%' });
	});

	it('clamps percentage above 100 to 100', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: 150 });
		expect(screen.getByText('100%')).toBeInTheDocument();
		const fill = container.querySelector<HTMLElement>('.engagement-mini__progress');
		expect(fill).toHaveStyle({ inlineSize: '100%' });
	});

	it('clamps percentage below 0 to 0', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: -10 });
		expect(screen.getByText('0%')).toBeInTheDocument();
		const fill = container.querySelector<HTMLElement>('.engagement-mini__progress');
		expect(fill).toHaveStyle({ inlineSize: '0%' });
	});

	it('handles non-finite percentage as 0', () => {
		renderRow({ isViewed: true, viewPercentage: NaN });
		expect(screen.getByText('0%')).toBeInTheDocument();
	});

	it('sets aria attributes on the progressbar wrapper', () => {
		const { container } = renderRow({ isViewed: true, viewPercentage: 42 });
		const wrapper = container.querySelector<HTMLElement>('.engagement-mini');
		expect(wrapper).toHaveAttribute('role', 'progressbar');
		expect(wrapper).toHaveAttribute('aria-valuenow', '42');
		expect(wrapper).toHaveAttribute('aria-valuemin', '0');
		expect(wrapper).toHaveAttribute('aria-valuemax', '100');
		expect(wrapper).toHaveAttribute('aria-label', 'Visualización de la invitación: 42%');
	});

	it('shows 1 group tag chip in compact name cell', () => {
		renderRow({ tags: ['VIP'] });
		expect(screen.getByText('VIP')).toBeInTheDocument();
	});

	it('shows +N overflow chip when more than 1 tag', () => {
		renderRow({ tags: ['Familia', 'Amigos', 'VIP'] });
		expect(screen.getByText('Familia')).toBeInTheDocument();
		expect(screen.getByText('+2')).toBeInTheDocument();
	});

	it('does not show group chips when tags are empty', () => {
		renderRow({ tags: [] });
		expect(screen.queryByText('Familia')).not.toBeInTheDocument();
		expect(screen.queryByText('Amigos')).not.toBeInTheDocument();
	});
});
