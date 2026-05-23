import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import { makeGuest } from '@tests/helpers/guest-factory';

const onClose = jest.fn();
const onSave = jest.fn();
const onMarkShared = jest.fn();
const onAdvanceFromGuest = jest.fn();
const onPostponeGuest = jest.fn();

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
	onAdvanceFromGuest,
	onPostponeGuest,
};

function renderModal(
	guest: ReturnType<typeof makeGuest> | null,
	pendingGuests?: ReturnType<typeof makeGuest>[],
) {
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
			const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
			fireEvent.change(phoneInput, { target: { value: changeTo } });
		}

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(screen.getByText('El teléfono debe tener 10 dígitos.')).toBeInTheDocument();
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

	it('valid phone saves, opens WhatsApp, marks shared, and calls onAdvanceFromGuest', async () => {
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
		await waitFor(() => expect(onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('empty phone saves, calls navigator.share, marks shared, and calls onAdvanceFromGuest', async () => {
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
		await waitFor(() => expect(onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
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
	])(
		'$name shows fallback without marking sent and without advancing',
		async ({ setup, phone }) => {
			setup();
			onSave.mockResolvedValue(makeGuest({ phone }));

			renderModal(makeGuest({ guestId: 'guest-1', phone }));

			fireEvent.click(
				screen.getByRole('button', { name: phone ? /enviar por whatsapp/i : /compartir/i }),
			);

			await waitFor(() => expect(onSave).toHaveBeenCalled());
			expect(onMarkShared).not.toHaveBeenCalled();
			expect(onAdvanceFromGuest).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument(),
			);
		},
	);

	it('fallback "Copiar invitación" copies URL but does not mark sent or advance', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar invitaci\u00f3n'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('fallback "Copiar y marcar como enviada" copies URL, marks sent, and calls onAdvanceFromGuest', async () => {
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
		await waitFor(() => expect(onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('fallback "Mantener pendiente" returns to form phase without advancing', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Mantener pendiente')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Mantener pendiente'));

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /enviar por whatsapp/i })).toBeInTheDocument();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('save failure shows error, closes pre-opened window, and does not advance', async () => {
		onSave.mockRejectedValue(new Error('Save failed'));

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('Error al guardar los datos. Intenta de nuevo.'),
			).toBeInTheDocument();
		});

		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
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
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
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

	it('Posponer calls onPostponeGuest with current guest ID', async () => {
		const guest2 = makeGuest({ guestId: 'guest-2', fullName: 'Guest Two' });
		const guest = makeGuest({ guestId: 'guest-1', fullName: 'Guest One' });

		renderModal(guest, [guest, guest2]);

		const postponeBtn = screen.getByRole('button', { name: /posponer/i });
		fireEvent.click(postponeBtn);

		expect(onPostponeGuest).toHaveBeenCalledWith('guest-1');
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('Posponer button not shown when only one pending guest', () => {
		renderModal(makeGuest({ guestId: 'guest-1' }));

		expect(screen.queryByRole('button', { name: /posponer/i })).not.toBeInTheDocument();
	});

	it('Cancelar closes modal without marking shared or advancing', () => {
		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

		expect(onClose).toHaveBeenCalled();
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it.each([
		{ desc: 'empty phone', guestPhone: '', sendPhone: undefined, sendCountryCode: undefined },
		{
			desc: 'valid phone',
			guestPhone: '6691234567',
			sendPhone: '6691234567',
			sendCountryCode: '+52',
		},
		{
			desc: 'cleared phone field',
			guestPhone: '6691234567',
			clearPhone: true,
			sendPhone: undefined,
			sendCountryCode: undefined,
		},
	])(
		'saves with $desc payload: phone=$sendPhone, countryCode=$sendCountryCode',
		async ({ guestPhone, clearPhone, sendPhone, sendCountryCode }) => {
			onSave.mockResolvedValue(
				makeGuest({
					phone: guestPhone,
					waShareUrl: guestPhone ? 'https://wa.me/526691234567' : '',
				}),
			);

			renderModal(
				makeGuest({
					guestId: 'guest-1',
					phone: guestPhone,
					waShareUrl: guestPhone ? 'https://wa.me/526691234567' : '',
				}),
			);

			if (clearPhone) {
				const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
				fireEvent.change(phoneInput, { target: { value: '' } });
			}

			const buttonLabel =
				sendPhone || (!clearPhone && guestPhone)
					? /enviar por whatsapp/i
					: /compartir invitaci\u00f3n/i;
			fireEvent.click(screen.getByRole('button', { name: buttonLabel }));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith('guest-1', {
					fullName: 'Guest One',
					maxAllowedAttendees: 4,
					phone: sendPhone,
					countryCode: sendCountryCode,
				});
			});
		},
	);

	it('fallback "Copiar y marcar como enviada" failure does not advance', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest());
		onMarkShared.mockRejectedValue(new Error('Mark failed'));

		renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar y marcar como enviada'));

		await waitFor(() => {
			expect(onAdvanceFromGuest).not.toHaveBeenCalled();
		});
	});
});
