import { render, screen } from '@testing-library/react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import { makeGuest } from '@tests/helpers/guest-factory';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

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
		eventTitle: 'Test Event',
		shareTemplates: {
			invitation:
				'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
			reminder:
				'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
		},
		onEdit: jest.fn(),
		onDelete: jest.fn().mockResolvedValue(undefined),
		onMarkShared: jest.fn().mockResolvedValue(undefined),
		shareDateContext: defaultShareDateContext(),
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

	it('shows "Por confirmar" when shared but not viewed and not yet confirmed', () => {
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
		expect(screen.getByText('Por confirmar')).toBeInTheDocument();
	});

	it('shows "Por confirmar" when shared and viewed but not yet confirmed', () => {
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
		expect(screen.getAllByText('Por confirmar').length).toBeGreaterThanOrEqual(1);
	});

	it('shows "Confirmada" when attendanceStatus is confirmed (overrides delivery status)', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'confirmed' })} {...baseProps} />);
		const labels = screen.getAllByText('Confirmada');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows "No asiste" when attendanceStatus is declined', () => {
		render(<GuestCard item={makeGuest({ attendanceStatus: 'declined' })} {...baseProps} />);
		const labels = screen.getAllByText('No asiste');
		expect(labels.length).toBeGreaterThanOrEqual(1);
	});

	it('shows delivery status in header pill when attendanceStatus is pending', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'pending' })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		// Header shows delivery-driven status for pending guests
		expect(screen.getAllByText('Por enviar').length).toBeGreaterThanOrEqual(1);
	});

	it('renders metadata row with attendance', () => {
		render(
			<GuestCard
				item={makeGuest({ attendeeCount: 0, maxAllowedAttendees: 4 })}
				{...baseProps}
			/>,
		);
		expect(screen.getAllByText(/asistentes/).length).toBeGreaterThanOrEqual(1);
	});

	it('shows "1 mensaje" in metadata row when guest has a message', () => {
		render(
			<GuestCard
				item={makeGuest({ guestComment: 'Gracias por la invitacion' })}
				{...baseProps}
			/>,
		);
		expect(screen.getAllByText(/1 mensaje/).length).toBeGreaterThanOrEqual(1);
	});

	it('does not show message count in metadata when guest has no message', () => {
		render(<GuestCard item={makeGuest({ guestComment: '' })} {...baseProps} />);
		expect(screen.queryByText(/mensaje/)).not.toBeInTheDocument();
	});

	it('shows "Copiar enlace" for confirmed guests (no dominant share CTA)', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'confirmed', deliveryStatus: 'shared' })}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('shows "Copiar enlace" for declined guests', () => {
		render(
			<GuestCard
				item={makeGuest({ attendanceStatus: 'declined', deliveryStatus: 'shared' })}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Copiar enlace')).toBeInTheDocument();
	});

	it('shows branding toggle in expanded actions when eligible', () => {
		const { container } = render(
			<GuestCard
				item={makeGuest({ hideCelebraMeBranding: true })}
				isExpanded={true}
				isBrandingRemovalEligible={true}
				onToggleBrandingRemoval={jest.fn()}
				{...baseProps}
			/>,
		);
		expect(container.querySelector('[data-testid="expanded-actions"]')).toBeInTheDocument();
	});

	it('shows view percentage in expanded state Actividad section', () => {
		const { container, rerender } = render(
			<GuestCard
				item={makeGuest({ isViewed: true, viewPercentage: 100 })}
				isExpanded={false}
				{...baseProps}
			/>,
		);
		// Content is in DOM but hidden via CSS when collapsed
		expect(container.querySelector('.guest-card__expanded--open')).toBeNull();

		rerender(
			<GuestCard
				item={makeGuest({ isViewed: true, viewPercentage: 100 })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		expect(container.querySelector('.guest-card__expanded--open')).toBeInTheDocument();
		expect(screen.getByText('Vista 100%')).toBeInTheDocument();
	});

	it('shows guest message in expanded panel with a formatted timestamp', () => {
		const { container } = render(
			<GuestCard
				item={makeGuest({
					guestComment: 'Nos vemos pronto',
					respondedAt: '2026-03-22T12:30:00.000Z',
				})}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		expect(container.querySelector('.guest-message-history')).toBeInTheDocument();
		expect(container.querySelector('.guest-message-history__text')).toHaveTextContent(
			'Nos vemos pronto',
		);
		const meta = container.querySelector('.guest-message-history__meta');
		expect(meta).toHaveTextContent('22 mar 2026');
		expect(meta).not.toHaveTextContent('Mensaje inicial');
	});

	it('does not show message block when no guest comment', () => {
		const { container } = render(
			<GuestCard item={makeGuest({ guestComment: '' })} isExpanded={true} {...baseProps} />,
		);
		expect(container.querySelector('.guest-message-history')).not.toBeInTheDocument();
	});

	it('renders group section titles in expanded state', () => {
		render(
			<GuestCard
				item={makeGuest({
					attendanceStatus: 'confirmed',
					firstViewedAt: '2026-06-10T00:00:00.000Z',
				})}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		expect(screen.getByText('Resumen')).toBeInTheDocument();
		expect(screen.getByText('Actividad')).toBeInTheDocument();
		expect(screen.getByText('Origen')).toBeInTheDocument();
	});

	it('shows first group tag chip when expanded', () => {
		render(
			<GuestCard
				item={makeGuest({ tags: ['Familia', 'Amigos'] })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		const familiaChips = screen.getAllByText('Familia');
		expect(familiaChips.length).toBeGreaterThanOrEqual(1);
	});

	it('shows all tags when expanded', () => {
		render(
			<GuestCard
				item={makeGuest({ tags: ['Familia', 'Amigos', 'VIP', 'Trabajo'] })}
				isExpanded={true}
				{...baseProps}
			/>,
		);
		const familiaChips = screen.getAllByText('Familia');
		expect(familiaChips.length).toBeGreaterThanOrEqual(1);
		const amigoChips = screen.getAllByText('Amigos');
		expect(amigoChips.length).toBeGreaterThanOrEqual(1);
	});

	it('does not show group chips when no tags and expanded', () => {
		const { container } = render(
			<GuestCard item={makeGuest({ tags: [] })} isExpanded={true} {...baseProps} />,
		);
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
