import { act, render, screen } from '@testing-library/react';
import GuestTableRow from '@/components/dashboard/guests/GuestTableRow';
import { makeGuest } from '@tests/helpers/guest-factory';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { defaultShareDateContext } from '@tests/helpers/test-fixtures';

jest.mock('@/components/dashboard/guests/ShareAction', () => ({
	__esModule: true,
	default: () => <div data-testid="share-action" />,
}));

describe('GuestTableRow — status, people and actions', () => {
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
		onOpenDetails: jest.fn(),
		onMarkShared: jest.fn().mockResolvedValue(undefined),
		shareDateContext: defaultShareDateContext(),
	};

	const renderRow = (overrides: Partial<DashboardGuestItem> = {}) =>
		render(
			<table>
				<tbody>
					<GuestTableRow item={makeGuest(overrides)} {...baseProps} />
				</tbody>
			</table>,
		);

	it.each([
		[{ deliveryStatus: 'shared' as const, isViewed: false }, 'Enviada, sin abrir'],
		[{ deliveryStatus: 'shared' as const, isViewed: true }, 'Abierta, sin responder'],
		[{ deliveryStatus: 'generated' as const }, 'Por enviar'],
	])('labels the stage of an unanswered invitation', (overrides, label) => {
		renderRow(overrides);
		expect(screen.getByText(label)).toBeInTheDocument();
	});

	it('describes people for a partial confirmation', () => {
		renderRow({ attendanceStatus: 'confirmed', maxAllowedAttendees: 4, attendeeCount: 2 });
		expect(screen.getByText('Vienen 2 de 4')).toBeInTheDocument();
		expect(screen.getByText('2 lugares no usados')).toBeInTheDocument();
	});

	it.each(['pending', 'confirmed', 'declined'] as const)(
		'always offers "Copiar enlace" (%s)',
		(attendanceStatus) => {
			renderRow({ attendanceStatus, deliveryStatus: 'shared' });
			expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument();
		},
	);

	it('offers sharing only while the invitation has no answer', () => {
		const { unmount } = renderRow({ deliveryStatus: 'shared' });
		expect(screen.getByTestId('share-action')).toBeInTheDocument();
		unmount();

		renderRow({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' });
		expect(screen.queryByTestId('share-action')).not.toBeInTheDocument();
	});

	it('flags guests without a phone', () => {
		renderRow({ phone: '' });
		expect(screen.getByText('Sin teléfono')).toBeInTheDocument();
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

describe('GuestTableRow — message toggle', () => {
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
		onOpenDetails: jest.fn(),
		onMarkShared: jest.fn().mockResolvedValue(undefined),
		shareDateContext: defaultShareDateContext(),
	};

	const renderRow = (overrides: Partial<DashboardGuestItem> = {}) =>
		render(
			<table>
				<tbody>
					<GuestTableRow item={makeGuest(overrides)} {...baseProps} />
				</tbody>
			</table>,
		);

	it('renders message button when guestComment exists', () => {
		renderRow({ guestComment: 'Nos vemos pronto' });
		expect(screen.getByRole('button', { name: /ver mensaje/i })).toBeInTheDocument();
	});

	it('does not render message button when guestComment is empty', () => {
		renderRow({ guestComment: '' });
		expect(screen.queryByRole('button', { name: /mensaje/i })).not.toBeInTheDocument();
	});

	it('shows message row on button click', () => {
		const { container } = renderRow({ guestComment: 'Hola, confirmamos' });
		const btn = screen.getByRole('button', { name: /ver mensaje/i });
		act(() => btn.click());
		const panel = container.querySelector('.guest-message-panel');
		expect(panel).toBeInTheDocument();
		expect(panel).toHaveTextContent('Hola, confirmamos');
	});

	it('hides message row on second click', () => {
		const { container } = renderRow({ guestComment: 'Saludos' });
		const btn = screen.getByRole('button', { name: /ver mensaje/i });
		act(() => btn.click());
		expect(container.querySelector('.guest-message-panel')).toBeInTheDocument();
		act(() => btn.click());
		expect(container.querySelector('.guest-message-panel')).not.toBeInTheDocument();
	});

	it('shows message label and text content with a formatted timestamp', () => {
		const { container } = renderRow({
			guestComment: '¡Nos vemos!',
			respondedAt: '2026-03-22T12:30:00.000Z',
		});
		act(() => screen.getByRole('button', { name: /ver mensaje/i }).click());
		expect(container.querySelector('.guest-message-history__title')).toHaveTextContent(
			'Mensajes del invitado',
		);
		expect(container.querySelector('.guest-message-history__text')).toHaveTextContent(
			'¡Nos vemos!',
		);
		const meta = container.querySelector('.guest-message-history__meta');
		expect(meta).toHaveTextContent('22 mar 2026');
		expect(meta).not.toHaveTextContent('Mensaje inicial');
	});

	it('opens the details panel from the name and the chevron', () => {
		const onOpenDetails = jest.fn();
		const item = makeGuest({ fullName: 'Tía Carmen' });
		render(
			<table>
				<tbody>
					<GuestTableRow item={item} {...baseProps} onOpenDetails={onOpenDetails} />
				</tbody>
			</table>,
		);
		act(() => screen.getByRole('button', { name: 'Tía Carmen' }).click());
		act(() => screen.getByRole('button', { name: 'Ver detalles de Tía Carmen' }).click());
		expect(onOpenDetails).toHaveBeenCalledTimes(2);
		expect(onOpenDetails).toHaveBeenCalledWith(item);
	});

	it('sets aria-expanded and aria-controls on the button', () => {
		renderRow({ guestComment: 'Hola' });
		const btn = screen.getByRole('button', { name: /ver mensaje/i });
		expect(btn).toHaveAttribute('aria-expanded', 'false');
		expect(btn).toHaveAttribute('aria-controls');
		act(() => btn.click());
		expect(btn).toHaveAttribute('aria-expanded', 'true');
	});
});
