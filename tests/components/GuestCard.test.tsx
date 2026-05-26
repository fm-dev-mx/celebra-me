import { act, render, screen } from '@testing-library/react';
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
		expect(screen.getAllByText('Por enviar').length).toBeGreaterThanOrEqual(1);
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

	it('shows "Confirmada" when attendanceStatus is confirmed (overrides delivery status)', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'confirmed' })} {...baseProps} />);
		// The status label appears in the status pill header AND in the expanded RSVP detail.
		// getAllByText ensures we find at least one occurrence.
		const labels = screen.getAllByText('Confirmada');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "No asiste" when attendanceStatus is declined', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'declined' })} {...baseProps} />);
		const labels = screen.getAllByText('No asiste');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "Sin respuesta" in RSVP details when attendanceStatus is pending', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'pending' })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Sin respuesta')).toBeInTheDocument();
	});

	it('uses clear mobile card metrics for attendance and view state', () => {
		render(
			<GuestCard item={makeGuest({ isViewed: true, viewPercentage: 100 })} {...baseProps} />,
		);
		expect(screen.getByText('Asistentes:')).toBeInTheDocument();
		expect(screen.getByText('Vista: 100%')).toBeInTheDocument();
	});

	it('shows "Sin marca" badge when branding removal is active', () => {
		render(<GuestCard item={makeGuest({ hideCelebraMeBranding: true })} {...baseProps} />);
		expect(screen.getByText('Sin marca')).toBeInTheDocument();
	});

	it('does not show "Sin marca" badge when branding removal is inactive', () => {
		render(<GuestCard item={makeGuest({ hideCelebraMeBranding: false })} {...baseProps} />);
		expect(screen.queryByText('Sin marca')).not.toBeInTheDocument();
	});

	it('renders engagement progress bar with correct width and aria attributes when expanded', () => {
		const { container } = render(
			<GuestCard item={makeGuest({ viewPercentage: 67 })} isExpanded={true} {...baseProps} />,
		);
		const mini = container.querySelector('.engagement-mini');
		expect(mini).toBeInTheDocument();
		expect(mini).toHaveAttribute('value', '67');
		expect(mini).toHaveAttribute('max', '100');
		expect(mini).toHaveAttribute('role', 'progressbar');
		expect(mini).toHaveAttribute('aria-valuenow', '67');
		expect(mini).toHaveAttribute('aria-valuemin', '0');
		expect(mini).toHaveAttribute('aria-valuemax', '100');
	});

	it('shows a guest message button only when guestComment exists', () => {
		const { container, rerender } = render(
			<GuestCard item={makeGuest({ guestComment: '' })} {...baseProps} />,
		);
		expect(container.querySelector('.guest-card__msg-btn')).not.toBeInTheDocument();
		expect(container.querySelector('.guest-card__message-block')).not.toBeInTheDocument();

		rerender(
			<GuestCard item={makeGuest({ guestComment: 'Nos vemos pronto' })} {...baseProps} />,
		);
		const btn = container.querySelector('.guest-card__msg-btn');
		expect(btn).toHaveTextContent('Ver mensaje');

		// Block is not rendered until button is clicked
		expect(container.querySelector('.guest-card__message-block')).not.toBeInTheDocument();
	});

	it('opens message block on toggle click', () => {
		const { container } = render(
			<GuestCard
				item={makeGuest({ guestComment: 'Hola, confirmamos asistencia' })}
				{...baseProps}
			/>,
		);
		const btn = container.querySelector<HTMLElement>('.guest-card__msg-btn');
		expect(btn).toBeInTheDocument();
		act(() => {
			btn?.click();
		});
		const block = container.querySelector('.guest-card__message-block');
		expect(block).toBeInTheDocument();
		expect(container.querySelector('.guest-card__message-label')).toHaveTextContent(
			'Mensaje del invitado',
		);
		expect(container.querySelector('.guest-card__message-text')).toHaveTextContent(
			'Hola, confirmamos asistencia',
		);
	});

	it('renders progress bar width correctly at 0%, 50%, and 100%', () => {
		const renderAt = (pct: number) => {
			const { container } = render(
				<GuestCard
					item={makeGuest({ viewPercentage: pct })}
					isExpanded={true}
					{...baseProps}
				/>,
			);
			return container.querySelector<HTMLProgressElement>('.engagement-mini');
		};

		const p0 = renderAt(0);
		expect(p0).toHaveAttribute('value', '0');

		const p50 = renderAt(50);
		expect(p50).toHaveAttribute('value', '50');

		const p100 = renderAt(100);
		expect(p100).toHaveAttribute('value', '100');
	});

	it('renders closed-card view status as percentage, not boolean text', () => {
		render(
			<GuestCard item={makeGuest({ isViewed: true, viewPercentage: 67 })} {...baseProps} />,
		);
		expect(screen.getByText('Vista: 67%')).toBeInTheDocument();
		expect(screen.queryByText('Vista: Sí')).not.toBeInTheDocument();
	});

	it('clamps viewPercentage above 100 to 100 in closed card', () => {
		render(
			<GuestCard item={makeGuest({ isViewed: true, viewPercentage: 150 })} {...baseProps} />,
		);
		expect(screen.getByText('Vista: 100%')).toBeInTheDocument();
	});

	it('clamps viewPercentage below 0 to 0 in closed card', () => {
		render(
			<GuestCard item={makeGuest({ isViewed: true, viewPercentage: -10 })} {...baseProps} />,
		);
		expect(screen.getByText('Vista: 0%')).toBeInTheDocument();
	});

	it('clamps viewPercentage above 100 in expanded progress bar value', () => {
		const { container } = render(
			<GuestCard
				item={makeGuest({ viewPercentage: 200 })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		const mini = container.querySelector('.engagement-mini');
		expect(mini).toHaveAttribute('value', '100');
		expect(mini).toHaveAttribute('aria-valuenow', '100');
	});

	it('clamps non-finite viewPercentage to 0', () => {
		render(
			<GuestCard item={makeGuest({ isViewed: true, viewPercentage: NaN })} {...baseProps} />,
		);
		expect(screen.getByText('Vista: 0%')).toBeInTheDocument();
	});

	it('shows group tag chips in compact header', () => {
		render(<GuestCard item={makeGuest({ tags: ['Familia', 'Amigos'] })} {...baseProps} />);
		const familiaChips = screen.getAllByText('Familia');
		expect(familiaChips.length).toBeGreaterThanOrEqual(1);
		const amigosChips = screen.getAllByText('Amigos');
		expect(amigosChips.length).toBeGreaterThanOrEqual(1);
	});

	it('shows overflow chip when more than 2 tags', () => {
		render(
			<GuestCard
				item={makeGuest({ tags: ['Familia', 'Amigos', 'VIP', 'Trabajo'] })}
				{...baseProps}
			/>,
		);
		const familiaChips = screen.getAllByText('Familia');
		expect(familiaChips.length).toBeGreaterThanOrEqual(1);
		const amigosChips = screen.getAllByText('Amigos');
		expect(amigosChips.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('+2')).toBeInTheDocument();
	});

	it('does not show group chips when no tags', () => {
		const { container } = render(<GuestCard item={makeGuest({ tags: [] })} {...baseProps} />);
		const chips = container.querySelectorAll('.guest-tag');
		const groupChips = Array.from(chips).filter(
			(c) =>
				c.textContent === 'Familia' ||
				c.textContent === 'Amigos' ||
				c.textContent === 'VIP',
		);
		expect(groupChips.length).toBe(0);
	});
});
