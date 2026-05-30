import { useState } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	setupNavigatorShare,
	removeNavigatorShare,
	setupNavigatorClipboard,
	createMockWindow,
	stubWindowOpen,
} from '@tests/helpers/nav-test-utils';

function createProps() {
	return {
		inviteBaseUrl: 'http://localhost',
		onClose: jest.fn(),
		onSave: jest.fn(),
		onMarkShared: jest.fn(),
		onAdvanceFromGuest: jest.fn(),
		onPostponeGuest: jest.fn(),
	};
}

function renderModal(
	guest: ReturnType<typeof makeGuest> | null,
	pendingGuests?: ReturnType<typeof makeGuest>[],
	propsOverrides?: Partial<ReturnType<typeof createProps>>,
) {
	const props = { ...createProps(), ...propsOverrides };
	return {
		...render(
			<SendInvitationModal
				{...props}
				guest={guest}
				pendingGuests={pendingGuests ?? (guest ? [guest] : [])}
			/>,
		),
		props,
	};
}

let mockWindow: ReturnType<typeof createMockWindow>;

beforeEach(() => {
	jest.clearAllMocks();
	mockWindow = createMockWindow();
	stubWindowOpen(mockWindow as unknown as Window);
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

	it('no-phone guest shows editable form with empty phone field', () => {
		renderModal(makeGuest({ phone: '', waShareUrl: '' }));

		const nameInput = screen.getByDisplayValue('Guest One');
		expect(nameInput).toBeInTheDocument();
		expect((nameInput as HTMLInputElement).tagName).toBe('INPUT');
		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: /Teléfono/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /compartir invitación/i })).toBeInTheDocument();
	});

	it('empty phone saves then shares via native share without opening WhatsApp', async () => {
		const { props } = renderModal(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				shareText: 'Saved share text',
				inviteId: 'invite-1',
			}),
		);
		props.onSave.mockResolvedValue(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				shareText: 'Saved share text',
				inviteId: 'invite-1',
			}),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		await waitFor(() =>
			expect(navigator.share).toHaveBeenCalledWith({
				title: 'Invitación Celebra-me',
				text: 'Saved share text',
				url: 'http://localhost/invitacion/invite-1',
			}),
		);
		expect(window.open).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('empty phone native share unavailable saves then shows fallback without marking sent', async () => {
		removeNavigatorShare();
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));
		props.onSave.mockResolvedValue(
			makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }),
		);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());
	});

	it('blocks submit with invalid non-empty phone and shows inline error', async () => {
		const { props } = renderModal(makeGuest({ phone: '123' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => {
			expect(screen.getByText('El teléfono debe tener 10 dígitos.')).toBeInTheDocument();
		});

		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('allows submit with valid phone', async () => {
		const { props } = renderModal(makeGuest({ phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalled();
		});
	});

	it('submit updates name, max attendees, and phone fields', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		const nameInput = screen.getByDisplayValue('Guest One');
		fireEvent.change(nameInput, { target: { value: 'Edited Name' } });

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited Name',
				maxAllowedAttendees: 4,
				phone: '6691234567',
				countryCode: '+52',
			});
		});
	});

	it('repeated clicks do not duplicate save calls', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		const btn = screen.getByRole('button', { name: /enviar por whatsapp/i });
		fireEvent.click(btn);
		fireEvent.click(btn);

		await act(async () => {
			await new Promise((r) => setTimeout(r, 50));
		});

		expect(props.onSave).toHaveBeenCalledTimes(1);
	});

	it('valid phone saves, opens WhatsApp, marks shared, and calls onAdvanceFromGuest', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }), [
			makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }),
			makeGuest({
				guestId: 'guest-2',
				fullName: 'Guest Two',
				phone: '6697654321',
			}),
		]);
		props.onSave.mockResolvedValue(makeGuest({ fullName: 'Guest One Updated' }));
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() =>
			expect(props.onSave).toHaveBeenCalledWith('guest-1', expect.any(Object)),
		);
		await waitFor(() => expect(mockWindow.location.href).toBe('https://wa.me/526691234567'));
		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ fullName: 'Guest One Updated' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('WhatsApp popup blocked shows fallback without marking sent and without advancing', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());
	});

	it('navigator.share cancellation after save keeps invitation pending without fallback', async () => {
		const abortError = new DOMException('Share canceled', 'AbortError');
		Object.defineProperty(navigator, 'share', {
			value: jest.fn().mockRejectedValue(abortError),
			configurable: true,
			writable: true,
		});
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));
		props.onSave.mockResolvedValue(
			makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }),
		);

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => expect(navigator.share).toHaveBeenCalled());
		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
		expect(screen.queryByText('Copiar invitación')).not.toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: /compartir invitación/i }),
			).toBeInTheDocument(),
		);
	});

	it('no-phone guest can edit name and attendees before native share', async () => {
		const { props } = renderModal(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				fullName: 'Guest One',
				maxAllowedAttendees: 1,
			}),
		);
		props.onSave.mockResolvedValue(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				fullName: 'Edited Name',
				maxAllowedAttendees: 2,
			}),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.change(screen.getByDisplayValue('Guest One'), {
			target: { value: 'Edited Name' },
		});

		fireEvent.click(screen.getByRole('button', { name: /compartir invitación/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited Name',
				maxAllowedAttendees: 1,
				phone: undefined,
				countryCode: undefined,
			});
		});

		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ fullName: 'Edited Name' }),
			),
		);
	});

	it('no-phone guest who enters valid phone switches to WhatsApp path', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));
		props.onSave.mockResolvedValue(
			makeGuest({
				guestId: 'guest-1',
				phone: '6698765432',
				waShareUrl: 'https://wa.me/526698765432',
				fullName: 'Guest One Updated',
			}),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
		fireEvent.change(phoneInput, { target: { value: '6698765432' } });

		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('fallback "Copiar invitación" copies URL but does not mark sent or advance', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar invitación'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('fallback "Copiar y marcar como enviada" copies URL, marks sent, and calls onAdvanceFromGuest', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar y marcar como enviada'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('fallback "Mantener pendiente" returns to form phase without advancing', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Mantener pendiente')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Mantener pendiente'));

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /enviar por whatsapp/i })).toBeInTheDocument();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('save failure shows error, closes pre-opened window, and does not advance', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockRejectedValue(new Error('Save failed'));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('Error al guardar los datos. Intenta de nuevo.'),
			).toBeInTheDocument();
		});

		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('onMarkShared failure during WhatsApp flow shows error in fallback and does not advance', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }), [
			makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }),
			makeGuest({
				guestId: 'guest-2',
				fullName: 'Guest Two',
				phone: '6697654321',
			}),
		]);
		props.onSave.mockResolvedValue(makeGuest({ guestId: 'guest-1' }));
		props.onMarkShared.mockRejectedValue(new Error('Mark failed'));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(screen.getByText('Error al registrar el envío.')).toBeInTheDocument();
		});

		expect(screen.getByText('Guest One')).toBeInTheDocument();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('server-returned item used for final WhatsApp URL via getGuestInviteUrl', async () => {
		const returnedGuest = makeGuest({
			guestId: 'guest-1',
			fullName: 'Returned Name',
			inviteId: 'returned-invite',
			waShareUrl: 'https://wa.me/526691234567',
		});
		const { props } = renderModal(
			makeGuest({
				guestId: 'guest-1',
				fullName: 'Original Name',
				inviteId: 'original-invite',
			}),
		);
		props.onSave.mockResolvedValue(returnedGuest);

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(mockWindow.location.href).toBe(returnedGuest.waShareUrl);
		});
	});

	it('Posponer calls onPostponeGuest with current guest ID', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }), [
			makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }),
			makeGuest({ guestId: 'guest-2', fullName: 'Guest Two' }),
		]);

		const postponeBtn = screen.getByRole('button', { name: /posponer/i });
		fireEvent.click(postponeBtn);

		expect(props.onPostponeGuest).toHaveBeenCalledWith('guest-1');
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('Posponer button not shown when only one pending guest', () => {
		renderModal(makeGuest({ guestId: 'guest-1' }));

		expect(screen.queryByRole('button', { name: /posponer/i })).not.toBeInTheDocument();
	});

	it('Cancelar closes modal without marking shared or advancing', () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

		expect(props.onClose).toHaveBeenCalled();
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
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
			const { props } = renderModal(
				makeGuest({
					guestId: 'guest-1',
					phone: guestPhone,
					waShareUrl: guestPhone ? 'https://wa.me/526691234567' : '',
				}),
			);
			props.onSave.mockResolvedValue(
				makeGuest({
					phone: guestPhone,
					waShareUrl: guestPhone ? 'https://wa.me/526691234567' : '',
				}),
			);

			if (clearPhone) {
				const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
				fireEvent.change(phoneInput, { target: { value: '' } });
			}

			const sendLabel = clearPhone ? /compartir invitación/i : /enviar por whatsapp/i;
			fireEvent.click(screen.getByRole('button', { name: sendLabel }));

			await waitFor(() => {
				expect(props.onSave).toHaveBeenCalledWith('guest-1', {
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
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockRejectedValue(new Error('Mark failed'));

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar y marcar como enviada'));

		await waitFor(() => {
			expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
		});
	});

	it('advances to the next pending guest and shows their data after current guest is sent', async () => {
		const props = createProps();
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
					onClose={props.onClose}
					onSave={props.onSave}
					onMarkShared={props.onMarkShared}
					onAdvanceFromGuest={(id) => {
						if (id === 'g-a') setGuest(GuestB);
					}}
					onPostponeGuest={props.onPostponeGuest}
				/>
			);
		};

		props.onSave.mockResolvedValue(updatedA);
		props.onMarkShared.mockResolvedValue(undefined);

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
		const props = createProps();
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
					onClose={props.onClose}
					onSave={props.onSave}
					onMarkShared={props.onMarkShared}
					onAdvanceFromGuest={() => setGuest(null)}
					onPostponeGuest={props.onPostponeGuest}
				/>
			);
		};

		props.onSave.mockResolvedValue(updatedGuest);
		props.onMarkShared.mockResolvedValue(undefined);

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
