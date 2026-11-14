import { fireEvent, render, screen, within } from '@testing-library/react';
import GuestLastMessage from '@/components/dashboard/guests/GuestLastMessage';
import GuestListRow from '@/components/dashboard/guests/GuestListRow';
import GuestMessageWall from '@/components/dashboard/guests/GuestMessageWall';
import {
	GuestLoadError,
	GuestListFeedback,
} from '@/components/dashboard/guests/GuestDashboardStates';
import {
	buildGuestMessageWall,
	GUEST_MESSAGE_READ_STORAGE_KEY,
} from '@/components/dashboard/guests/guest-presenter';
import { makeGuest } from '@tests/helpers/guest-factory';

const LONG_MESSAGE =
	'Muchas felicidades a los dos, les deseamos lo mejor en esta nueva etapa. ' +
	'Ahí estaremos con mucho gusto para celebrar con ustedes este día tan especial.';

describe('GuestLastMessage', () => {
	it('shows a single message in full, with no toggle', () => {
		render(<GuestLastMessage guestComment={LONG_MESSAGE} />);

		expect(screen.getByRole('heading', { name: 'Mensaje del invitado' })).toBeInTheDocument();
		expect(screen.getByText(LONG_MESSAGE)).toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('keeps the same toggle focused while earlier messages open and close', () => {
		const comment = 'Primero\n\n[12 jun 2026, 11:03] Segundo\n\n[13 jun 2026, 09:00] Tercero';
		render(<GuestLastMessage guestComment={comment} />);

		expect(screen.getByText('Tercero')).toBeVisible();
		expect(screen.getByText('Segundo')).not.toBeVisible();

		const toggle = screen.getByRole('button', { name: 'Ver 2 mensajes anteriores' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).not.toBeNull();

		toggle.focus();
		fireEvent.click(toggle);

		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(toggle).toHaveTextContent('Ocultar mensajes anteriores');
		expect(toggle).toHaveFocus();
		expect(screen.getByText('Segundo')).toBeVisible();
		expect(screen.getByText('Primero')).toBeVisible();
		// The first message has no timestamp; the answer date would misdate it.
		expect(screen.getByText('Primer mensaje')).toBeVisible();
	});

	it('keeps a message with paragraphs as one message', () => {
		const comment = 'Felicidades a los dos.\n\nCon cariño, la familia Luviano.';
		const { container } = render(<GuestLastMessage guestComment={comment} />);

		expect(screen.getByRole('heading', { name: 'Mensaje del invitado' })).toBeInTheDocument();
		expect(container.querySelector('.guest-last-message__text')?.textContent).toBe(comment);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('renders nothing without a message', () => {
		const { container } = render(<GuestLastMessage guestComment="   " />);
		expect(container).toBeEmptyDOMElement();
	});
});

describe('GuestListRow message preview', () => {
	it('previews the latest message instead of a generic label', () => {
		const guest = makeGuest({
			guestComment: 'Hola\n\n[12 jun 2026, 11:03] Llegamos tarde',
		});
		render(
			<GuestListRow item={guest} inviteUrl="https://example.com/i/1" onOpen={jest.fn()} />,
		);

		expect(screen.getByText('«Llegamos tarde»')).toBeInTheDocument();
	});
});

describe('buildGuestMessageWall', () => {
	it('keeps only guests with a message, newest answer first', () => {
		const older = makeGuest({
			guestId: 'g-older',
			guestComment: 'Felicidades',
			respondedAt: '2026-06-01T10:00:00.000Z',
		});
		const silent = makeGuest({ guestId: 'g-silent', guestComment: '' });
		const newer = makeGuest({
			guestId: 'g-newer',
			guestComment: 'Hola\n\n[12 jun 2026, 11:03] Ahí estaremos',
			respondedAt: '2026-06-12T17:03:00.000Z',
		});

		const wall = buildGuestMessageWall([older, silent, newer]);

		expect(wall.map((entry) => entry.item.guestId)).toEqual(['g-newer', 'g-older']);
		expect(wall[0]).toMatchObject({
			latest: 'Ahí estaremos',
			timestampLabel: '12 jun 2026, 11:03',
			count: 2,
		});
	});
});

describe('GuestMessageWall', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('lists every message in full, shows "Mensaje nuevo", and records the read on open', () => {
		const onOpen = jest.fn();
		const guest = makeGuest({
			guestId: 'g-ruiz',
			fullName: 'Familia Ruiz',
			guestComment: LONG_MESSAGE,
		});
		const { unmount } = render(
			<GuestMessageWall
				items={[guest, makeGuest({ guestId: 'g-2', guestComment: '' })]}
				onOpenDetails={onOpen}
			/>,
		);

		const wall = screen.getByRole('region', { name: 'Mensajes de sus invitados' });
		expect(within(wall).getByText('Del más reciente al más antiguo.')).toBeInTheDocument();
		const card = within(wall).getByRole('article', { name: 'Familia Ruiz' });
		expect(within(card).getByText(LONG_MESSAGE)).toBeInTheDocument();
		expect(within(card).getByText('Mensaje nuevo')).toBeInTheDocument();

		fireEvent.click(within(card).getByRole('button', { name: 'Ver detalles de Familia Ruiz' }));
		expect(onOpen).toHaveBeenCalledWith(guest);
		expect(within(card).queryByText('Mensaje nuevo')).not.toBeInTheDocument();
		expect(window.localStorage.getItem(GUEST_MESSAGE_READ_STORAGE_KEY)).toContain('g-ruiz');

		unmount();
		render(<GuestMessageWall items={[guest]} onOpenDetails={onOpen} />);
		expect(screen.queryByText('Mensaje nuevo')).not.toBeInTheDocument();
	});

	it('shows "Mensaje nuevo" again when a read guest sends a newer message', () => {
		const initial = makeGuest({
			guestId: 'g-ruiz',
			fullName: 'Familia Ruiz',
			guestComment: 'Primer mensaje',
		});
		const { rerender } = render(
			<GuestMessageWall items={[initial]} onOpenDetails={jest.fn()} />,
		);
		fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Familia Ruiz' }));
		expect(screen.queryByText('Mensaje nuevo')).not.toBeInTheDocument();

		const updated = makeGuest({
			guestId: 'g-ruiz',
			fullName: 'Familia Ruiz',
			guestComment: 'Primer mensaje\n\n[12 jun 2026, 11:03] Segundo mensaje',
		});
		rerender(<GuestMessageWall items={[updated]} onOpenDetails={jest.fn()} />);
		expect(screen.getByText('Mensaje nuevo')).toBeInTheDocument();
	});

	it('renders nothing when no guest left a message', () => {
		const { container } = render(
			<GuestMessageWall
				items={[makeGuest({ guestComment: '' })]}
				onOpenDetails={jest.fn()}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});
});

describe('GuestDashboardStates — load error and empty filter results', () => {
	it('renders the load error alert with retry CTA', () => {
		const onRetry = jest.fn();
		render(<GuestLoadError message="No se pudo cargar la lista." onRetry={onRetry} />);

		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la lista.');
		fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('renders nothing in GuestListFeedback when total invitations is 0', () => {
		const { container } = render(
			<GuestListFeedback total={0} visible={0} filtered={false} onClear={jest.fn()} />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it('renders empty search/filter feedback with clear CTA when visible is 0', () => {
		const onClear = jest.fn();
		render(<GuestListFeedback total={8} visible={0} filtered={true} onClear={onClear} />);

		expect(
			screen.getByText('Ninguna invitación coincide con la búsqueda o el filtro.'),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Ver todas las invitaciones' }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});
});
