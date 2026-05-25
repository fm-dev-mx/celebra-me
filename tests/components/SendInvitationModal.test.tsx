import { useState } from 'react';
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
		{ phone: '', expected: /compartir invitación/i },
	])('CTA shows "$expected" when phone is $phone', ({ phone, expected }) => {
		renderModal(makeGuest({ phone }));

		expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
	});

	it('no-phone guest shows saved data read-only', () => {
		renderModal(makeGuest({ phone: '', waShareUrl: '' }));

		expect(screen.getByText('Guest One')).toBeInTheDocument();
		expect(screen.getByText('Sin teléfono registrado')).toBeInTheDocument();
		expect(screen.queryByDisplayValue('Guest One')).not.toBeInTheDocument();
		expect(screen.queryByRole('textbox', { name: /Teléfono/ })).not.toBeInTheDocument();
	});

	it('empty phone shares directly without saving or opening WhatsApp', async () => {
		onMarkShared.mockResolvedValue(undefined);

		renderModal(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				shareText: 'Saved share text',
				inviteId: 'invite-1',
			}),
		);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() =>
			expect(navigator.share).toHaveBeenCalledWith({
				title: 'Invitación Celebra-me',
				text: 'Saved share text',
				url: 'http://localhost/invitacion/invite-1',
			}),
		);
		expect(onSave).not.toHaveBeenCalled();
		expect(window.open).not.toHaveBeenCalled();
		expect(screen.queryByText(/Invitación guardada/i)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /compartir enlace/i })).not.toBeInTheDocument();
		await waitFor(() =>
			expect(onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('empty phone native share unavailable shows fallback without marking sent', async () => {
		removeNavigatorShare();

		renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		expect(onSave).not.toHaveBeenCalled();
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());
	});

	it.each([{ phone: '123', desc: 'invalid non-empty' }])(
		'blocks submit with $desc phone and shows inline error',
		async ({ phone }) => {
			onSave.mockResolvedValue(makeGuest());
			const guest = makeGuest({ phone });
			renderModal(guest);

			fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

			await waitFor(() => {
				expect(screen.getByText('El teléfono debe tener 10 dígitos.')).toBeInTheDocument();
			});

			expect(onSave).not.toHaveBeenCalled();
		},
	);

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

	it('WhatsApp popup blocked shows fallback without marking sent and without advancing', async () => {
		window.open = jest.fn().mockReturnValue(null);
		onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(onSave).toHaveBeenCalled());
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitaci\u00f3n')).toBeInTheDocument());
	});

	it('navigator.share cancellation keeps the invitation pending without fallback', async () => {
		const abortError = new DOMException('Share canceled', 'AbortError');
		Object.defineProperty(navigator, 'share', {
			value: jest.fn().mockRejectedValue(abortError),
			configurable: true,
			writable: true,
		});

		renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => expect(navigator.share).toHaveBeenCalled());
		expect(onSave).not.toHaveBeenCalled();
		expect(onMarkShared).not.toHaveBeenCalled();
		expect(onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(screen.queryByText('Copiar invitaci\u00f3n')).not.toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: /compartir invitación/i }),
			).toBeInTheDocument(),
		);
	});

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
			sendPhone: null,
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

			fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

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

	it('advances to the next pending guest and shows their data after current guest is sent', async () => {
		const GuestA = makeGuest({
			guestId: 'g-a',
			fullName: 'Ana López',
			phone: '6691111111',
			countryCode: '+52',
		});
		const GuestB = makeGuest({
			guestId: 'g-b',
			fullName: 'María García',
			phone: '6692222222',
			countryCode: '+52',
		});
		const updatedA = makeGuest({
			...GuestA,
			guestId: 'g-a',
			waShareUrl: 'https://wa.me/526691111111',
		});

		const Wrapper = () => {
			const [guest, setGuest] = useState<ReturnType<typeof makeGuest> | null>(GuestA);
			return (
				<SendInvitationModal
					key={guest?.guestId ?? 'empty'}
					guest={guest}
					pendingGuests={[GuestA, GuestB]}
					inviteBaseUrl="http://localhost"
					onClose={onClose}
					onSave={onSave}
					onMarkShared={onMarkShared}
					onAdvanceFromGuest={(id) => {
						if (id === 'g-a') setGuest(GuestB);
					}}
					onPostponeGuest={onPostponeGuest}
				/>
			);
		};

		onSave.mockResolvedValue(updatedA);
		onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Ana López')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(screen.getByDisplayValue('María García')).toBeInTheDocument();
		});

		const phoneInput = screen.getByRole('textbox', { name: /Teléfono/i }) as HTMLInputElement;
		expect(phoneInput.value).toBe('6692222222');
		expect(screen.queryByDisplayValue('Ana López')).not.toBeInTheDocument();
	});

	it('shows empty state after the last pending guest is processed', async () => {
		const onlyGuest = makeGuest({
			guestId: 'g-only',
			fullName: 'Solo Invitado',
			phone: '6691111111',
			countryCode: '+52',
		});
		const updatedGuest = makeGuest({
			...onlyGuest,
			waShareUrl: 'https://wa.me/526691111111',
		});

		const Wrapper = () => {
			const [guest, setGuest] = useState<ReturnType<typeof makeGuest> | null>(onlyGuest);
			return (
				<SendInvitationModal
					key={guest?.guestId ?? 'empty'}
					guest={guest}
					pendingGuests={guest ? [guest] : []}
					inviteBaseUrl="http://localhost"
					onClose={onClose}
					onSave={onSave}
					onMarkShared={onMarkShared}
					onAdvanceFromGuest={() => setGuest(null)}
					onPostponeGuest={onPostponeGuest}
				/>
			);
		};

		onSave.mockResolvedValue(updatedGuest);
		onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Solo Invitado')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('No hay invitaciones pendientes por enviar.'),
			).toBeInTheDocument();
		});

		expect(screen.queryByDisplayValue('Solo Invitado')).not.toBeInTheDocument();
	});
});
