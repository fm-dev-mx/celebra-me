import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

function makeGuest(overrides: Partial<DashboardGuestItem> = {}): DashboardGuestItem {
	return {
		guestId: 'guest-1',
		inviteId: 'invite-1',
		fullName: 'Guest One',
		phone: '6691234567',
		phoneCountryCode: '+52',
		email: null,
		tags: [],
		metadata: {},
		maxAllowedAttendees: 4,
		attendanceStatus: 'pending',
		attendeeCount: 0,
		guestComment: '',
		deliveryStatus: 'generated',
		viewPercentage: 0,
		isViewed: false,
		firstViewedAt: null,
		respondedAt: null,
		waShareUrl: 'https://wa.me/526691234567',
		shareText: 'Share text',
		updatedAt: '2026-03-22T00:00:00.000Z',
		...overrides,
	};
}

const onClose = jest.fn();
const onSave = jest.fn();
const onMarkShared = jest.fn();

let mockWindow: { closed: boolean; location: { href: string }; close: jest.Mock };

function setupNavigatorShare() {
	Object.defineProperty(navigator, 'share', {
		value: jest.fn().mockResolvedValue(undefined),
		configurable: true,
		writable: true,
	});
}

function setupNavigatorClipboard() {
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText: jest.fn().mockResolvedValue(undefined) },
		configurable: true,
		writable: true,
	});
}

function removeNavigatorShare() {
	delete (navigator as unknown as Record<string, unknown>).share;
}

const defaultProps = {
	inviteBaseUrl: 'http://localhost',
	onClose,
	onSave,
	onMarkShared,
};

function renderModal(guest: DashboardGuestItem | null, pendingGuests?: DashboardGuestItem[]) {
	return render(
		<SendInvitationModal
			{...defaultProps}
			guest={guest}
			pendingGuests={pendingGuests ?? (guest ? [guest] : [])}
		/>,
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockWindow = { closed: false, location: { href: '' }, close: jest.fn() };
	window.open = jest.fn().mockReturnValue(mockWindow);
	setupNavigatorShare();
	setupNavigatorClipboard();
});

describe('SendInvitationModal', () => {
	it('renders guest name, max attendees, and phone fields in form phase', () => {
		renderModal(makeGuest());

		const nameInput = screen.getByDisplayValue('Guest One');
		expect(nameInput).toBeInTheDocument();
		expect((nameInput as HTMLInputElement).tagName).toBe('INPUT');

		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByDisplayValue('6691234567')).toBeInTheDocument();
	});

	it('shows empty state when guest is null', () => {
		renderModal(null);

		expect(screen.getByText('No hay invitaciones pendientes por enviar.')).toBeInTheDocument();
	});

	it.each([
		{ phone: '6691234567', expected: /enviar por whatsapp/i },
		{ phone: '', expected: /compartir invitaci\u00f3n/i },
	])('CTA shows "$expected" when phone is $phone', ({ phone, expected }) => {
		renderModal(makeGuest({ phone }));

		expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
	});

	it('allows submit with empty phone', async () => {
		onSave.mockResolvedValue(makeGuest());
		removeNavigatorShare();

		renderModal(makeGuest({ phone: '' }));

		fireEvent.click(screen.getByRole('button', { name: /compartir invitaci\u00f3n/i }));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalled();
		});
	});

	it.each([
		{ phone: '123', desc: 'invalid non-empty' },
		{ phone: '', changeTo: '12', desc: 'changed to invalid' },
	])('blocks submit with $desc phone and shows inline error', async ({ phone, changeTo }) => {
		onSave.mockResolvedValue(makeGuest());
		const guest = makeGuest({ phone });
		renderModal(guest);

		if (changeTo) {
			const phoneInput = screen.getByPlaceholderText('N\u00famero de tel\u00e9fono');
			fireEvent.change(phoneInput, { target: { value: changeTo } });
		}

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(
				screen.getByText('El teléfono debe tener al menos 8 dígitos.'),
			).toBeInTheDocument();
		});

		expect(onSave).not.toHaveBeenCalled();
	});

	it('allows submit with valid phone', async () => {
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest({ phone: '6691234567' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalled();
		});
	});

	it('submit updates name, max attendees, and phone fields', async () => {
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest());

		const nameInput = screen.getByDisplayValue('Guest One');
		fireEvent.change(nameInput, { target: { value: 'Edited Name' } });

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited Name',
				maxAllowedAttendees: 4,
				phone: '6691234567',
				countryCode: '+52',
			});
		});
	});

	it('repeated clicks do not duplicate save calls', async () => {
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest());

		const btn = screen.getByRole('button', { name: /enviar por whatsapp/i });
		fireEvent.click(btn);
		fireEvent.click(btn);

		await act(async () => {
			await new Promise((r) => setTimeout(r, 50));
		});

		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it('valid phone saves, opens WhatsApp, marks shared, and advances to next', async () => {
		onSave.mockResolvedValue(makeGuest({ fullName: 'Guest One Updated' }));
		onMarkShared.mockResolvedValue(undefined);

		const guest2 = makeGuest({
			guestId: 'guest-2',
			fullName: 'Guest Two',
			phone: '6697654321',
		});
		const guest = makeGuest({ guestId: 'guest-1', fullName: 'Guest One' });

		renderModal(guest, [guest, guest2]);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(onSave).toHaveBeenCalledWith('guest-1', expect.any(Object)));
		await waitFor(() => expect(mockWindow.location.href).toBe('https://wa.me/526691234567'));
		await waitFor(() =>
			expect(onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ fullName: 'Guest One Updated' }),
			),
		);
		await waitFor(() => expect(screen.getByDisplayValue('Guest Two')).toBeInTheDocument());
	});

	it('empty phone saves, calls navigator.share, marks shared, and advances to next', async () => {
		onSave.mockResolvedValue(makeGuest({ phone: '', inviteId: 'invite-1', waShareUrl: '' }));
		onMarkShared.mockResolvedValue(undefined);

		const guest2 = makeGuest({ guestId: 'guest-2', fullName: 'Guest Two', phone: '' });
		const guest = makeGuest({
			guestId: 'guest-1',
			fullName: 'Guest One',
			phone: '',
			waShareUrl: '',
		});

		renderModal(guest, [guest, guest2]);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitaci\u00f3n/i }));

		await waitFor(() => expect(onSave).toHaveBeenCalledWith('guest-1', expect.any(Object)));
		await waitFor(() => expect(navigator.share).toHaveBeenCalled());
		await waitFor(() =>
			expect(onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(screen.getByDisplayValue('Guest Two')).toBeInTheDocument());
	});

	it.each([
		{
			name: 'WhatsApp popup blocked',
			setup: () => {
				window.open = jest.fn().mockReturnValue(null);
			},
			phone: '6691234567',
		},
		{ name: 'navigator.share unavailable', setup: removeNavigatorShare, phone: '' },
		{
			name: 'navigator.share reject',
			setup: () => {
				Object.defineProperty(navigator, 'share', {
					value: jest.fn().mockRejectedValue(new Error('AbortError')),
					configurable: true,
					writable: true,
				});
			},
			phone: '',
		},
	])('$name shows fallback without marking sent', async ({ setup, phone }) => {
		setup();
		onSave.mockResolvedValue(makeGuest({ phone }));

		renderModal(makeGuest({ guestId: 'guest-1', phone }));

		fireEvent.click(
			screen.getByRole('button', { name: phone ? /enviar por whatsapp/i : /compartir/i }),
		);

		await waitFor(() => expect(onSave).toHaveBeenCalled());
		expect(onMarkShared).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());
	});

	it('fallback "Copiar invitación" copies URL but does not mark sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar invitaci\u00f3n'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		expect(onMarkShared).not.toHaveBeenCalled();
	});

	it('fallback "Copiar y marcar como enviada" copies URL and marks sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());
		onMarkShared.mockResolvedValue(undefined);

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar y marcar como enviada'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		await waitFor(() =>
			expect(onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
	});

	it('fallback "Mantener pendiente" returns to form phase', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Mantener pendiente')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Mantener pendiente'));

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /enviar por whatsapp/i })).toBeInTheDocument();
	});

	it('save failure shows error and closes pre-opened window', async () => {
		onSave.mockRejectedValue(new Error('Save failed'));

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('Error al guardar los datos. Intenta de nuevo.'),
			).toBeInTheDocument();
		});

		expect(onMarkShared).not.toHaveBeenCalled();
	});

	it('onMarkShared failure during WhatsApp flow shows error in fallback and does not advance', async () => {
		onSave.mockResolvedValue(makeGuest({ guestId: 'guest-1' }));
		onMarkShared.mockRejectedValue(new Error('Mark failed'));

		const guest2 = makeGuest({
			guestId: 'guest-2',
			fullName: 'Guest Two',
			phone: '6697654321',
		});
		const guest = makeGuest({ guestId: 'guest-1', fullName: 'Guest One' });

		renderModal(guest, [guest, guest2]);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(screen.getByText('Error al registrar el envío.')).toBeInTheDocument();
		});

		expect(screen.getByText('Guest One')).toBeInTheDocument();
		expect(screen.queryByDisplayValue('Guest Two')).not.toBeInTheDocument();
	});

	it('server-returned item used for final WhatsApp URL via getGuestInviteUrl', async () => {
		const returnedGuest = makeGuest({
			guestId: 'guest-1',
			fullName: 'Returned Name',
			inviteId: 'returned-invite',
			waShareUrl: 'https://wa.me/526691234567',
		});
		onSave.mockResolvedValue(returnedGuest);

		const originalGuest = makeGuest({
			guestId: 'guest-1',
			fullName: 'Original Name',
			inviteId: 'original-invite',
		});

		renderModal(originalGuest);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(mockWindow.location.href).toBe(returnedGuest.waShareUrl);
		});
	});
});
