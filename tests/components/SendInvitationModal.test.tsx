import { useState } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	setupNavigatorShare,
	setupNavigatorClipboard,
	createMockWindow,
	stubWindowOpen,
} from '@tests/helpers/nav-test-utils';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';

const DEFAULT_TEMPLATES: ShareMessagesConfig = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder:
		'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
};

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
				templates={DEFAULT_TEMPLATES}
				shareDateContext={{
					eventDate: '',
					daysUntilEvent: '',
					rsvpDeadline: '',
					eventTimingText: '',
					rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
				}}
				eventTitle="Test Event"
			/>,
		),
		props,
	};
}

function goToMessageStep() {
	fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
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

	it('shows Continuar button in form phase', () => {
		renderModal(makeGuest());
		expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
	});

	it('no-phone guest shows editable form with empty phone field', () => {
		renderModal(makeGuest({ phone: '', waShareUrl: '' }));

		const nameInput = screen.getByDisplayValue('Guest One');
		expect(nameInput).toBeInTheDocument();
		expect((nameInput as HTMLInputElement).tagName).toBe('INPUT');
		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: /Teléfono/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
	});

	it('blocks submit with invalid non-empty phone and shows inline error', async () => {
		const { props } = renderModal(makeGuest({ phone: '123' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

		await waitFor(() => {
			expect(screen.getByText('El teléfono debe tener 10 dígitos.')).toBeInTheDocument();
		});

		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('message step shows preview text for guest with context', async () => {
		renderModal(makeGuest({ fullName: 'María García' }));
		goToMessageStep();

		await waitFor(() => {
			expect(screen.getByText(/Revisa el mensaje/i)).toBeInTheDocument();
		});
		expect(screen.getByText(/Hola María García/)).toBeInTheDocument();
		expect(screen.getByText(/Test Event/)).toBeInTheDocument();
	});

	it('message step shows edit button when not editing', async () => {
		renderModal(makeGuest());
		goToMessageStep();

		await waitFor(() => {
			expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument();
		});
	});

	it('toggles to textarea when edit is clicked', async () => {
		renderModal(makeGuest());
		goToMessageStep();
		await waitFor(() => expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument());

		fireEvent.click(screen.getByText(/Editar mensaje/i));

		expect(screen.getByRole('textbox')).toBeInTheDocument();
	});

	it('edit message can be modified and saved inline', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		goToMessageStep();
		await waitFor(() => expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument());

		fireEvent.click(screen.getByText(/Editar mensaje/i));
		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Custom message text' } });

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
	});

	it('reset from template reverts to template-generated message', async () => {
		renderModal(makeGuest());
		goToMessageStep();
		await waitFor(() => expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument());

		fireEvent.click(screen.getByText(/Editar mensaje/i));
		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Custom edit' } });

		fireEvent.click(screen.getByText(/Restablecer desde plantilla/i));

		expect(screen.getByText(/Hola Guest One/)).toBeInTheDocument();
	});

	it('temporary edit does not mutate global templates or call update API', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		goToMessageStep();
		await waitFor(() => expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument());

		fireEvent.click(screen.getByText(/Editar mensaje/i));
		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Custom message' } });

		fireEvent.click(screen.getByRole('button', { name: /volver/i }));
		expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();

		goToMessageStep();
		await waitFor(() => {
			expect(screen.getByText(/Hola Guest One/)).toBeInTheDocument();
		});
	});

	it('CTA shows WhatsApp when phone is available', async () => {
		renderModal(makeGuest({ phone: '6691234567' }));
		goToMessageStep();

		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
	});

	it('CTA shows Copiar mensaje when phone is missing', async () => {
		renderModal(makeGuest({ phone: '', waShareUrl: '' }));
		goToMessageStep();

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /copiar mensaje/i })).toBeInTheDocument();
		});
	});

	it('Cancelar closes modal without marking shared or advancing', () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

		expect(props.onClose).toHaveBeenCalled();
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
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

	it('WhatsApp flow: saves, opens WhatsApp, marks shared, and advances', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }));
		props.onSave.mockResolvedValue(makeGuest({ fullName: 'Guest One Updated' }));
		props.onMarkShared.mockResolvedValue(undefined);

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() =>
			expect(props.onSave).toHaveBeenCalledWith('guest-1', expect.any(Object)),
		);
		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ fullName: 'Guest One Updated' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('WhatsApp popup blocked shows fallback without marking sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());
	});

	it('no-phone flow: saves and copies message, marks shared, and advances', async () => {
		const { props } = renderModal(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				shareText: 'Saved share text',
			}),
		);
		props.onSave.mockResolvedValue(
			makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		goToMessageStep();
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /copiar mensaje/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /copiar mensaje/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('save failure shows error and does not advance', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockRejectedValue(new Error('Save failed'));

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('Error al guardar los datos. Intenta de nuevo.'),
			).toBeInTheDocument();
		});

		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('repeated clicks do not duplicate save calls', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});

		const btn = screen.getByRole('button', { name: /enviar por whatsapp/i });
		fireEvent.click(btn);
		fireEvent.click(btn);

		await act(async () => {
			await new Promise((r) => setTimeout(r, 50));
		});

		expect(props.onSave).toHaveBeenCalledTimes(1);
	});

	it('submit updates name, attendees, and phone', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		const nameInput = screen.getByDisplayValue('Guest One');
		fireEvent.change(nameInput, { target: { value: 'Edited Name' } });

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
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

	it('no-phone flow with native share saves, shares, marks sent, and advances', async () => {
		const { props } = renderModal(
			makeGuest({
				guestId: 'guest-1',
				phone: '',
				waShareUrl: '',
				shareText: 'Custom share',
				inviteId: 'invite-1',
			}),
		);
		props.onSave.mockResolvedValue(
			makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		goToMessageStep();
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /copiar mensaje/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /copiar mensaje/i }));

		await waitFor(() => expect(props.onSave).toHaveBeenCalled());
		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('flow: Volver from message step returns to form step', async () => {
		const { props } = renderModal(makeGuest());
		goToMessageStep();

		await waitFor(() => {
			expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /volver/i }));

		expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('cancel edit returns to preview with original template message', async () => {
		renderModal(makeGuest({ fullName: 'Test Person' }));
		goToMessageStep();
		await waitFor(() => expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument());

		fireEvent.click(screen.getByText(/Editar mensaje/i));
		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'Edited text' } });

		fireEvent.click(screen.getByText(/Cancelar edición/i));

		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(screen.getByText(/Editar mensaje/i)).toBeInTheDocument();
	});

	it('saves with phone payload when phone is valid', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Guest One',
				maxAllowedAttendees: 4,
				phone: '6691234567',
				countryCode: '+52',
			});
		});
	});

	it('saves with null phone when phone field is cleared', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '' }));

		const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
		fireEvent.change(phoneInput, { target: { value: '' } });

		goToMessageStep();
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /copiar mensaje/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /copiar mensaje/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Guest One',
				maxAllowedAttendees: 4,
				phone: null,
				countryCode: undefined,
			});
		});
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
		'saves with $desc payload: phone=$sendPhone',
		async ({ guestPhone, clearPhone, sendPhone, sendCountryCode }) => {
			const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: guestPhone }));
			props.onSave.mockResolvedValue(makeGuest({ phone: guestPhone }));

			if (clearPhone) {
				const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
				fireEvent.change(phoneInput, { target: { value: '' } });
			}

			goToMessageStep();
			const sendLabel = clearPhone ? /copiar mensaje/i : /enviar por whatsapp/i;
			await waitFor(() => {
				expect(screen.getByRole('button', { name: sendLabel })).toBeInTheDocument();
			});
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

	it('advances to next pending guest after sending current one', async () => {
		const props = createProps();
		const GuestA = makeGuest({
			guestId: 'g-a',
			fullName: 'Ana López',
			phone: '6691111111',
		});
		const GuestB = makeGuest({
			guestId: 'g-b',
			fullName: 'María García',
			phone: '6692222222',
		});
		const updatedA = makeGuest({ ...GuestA, waShareUrl: 'https://wa.me/526691111111' });

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
					templates={DEFAULT_TEMPLATES}
					shareDateContext={{
						eventDate: '',
						daysUntilEvent: '',
						rsvpDeadline: '',
						eventTimingText: '',
						rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
					}}
					eventTitle="Test Event"
				/>
			);
		};

		props.onSave.mockResolvedValue(updatedA);
		props.onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Ana López')).toBeInTheDocument();
		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(screen.getByDisplayValue('María García')).toBeInTheDocument();
		});
	});

	it('shows empty state after processing last pending guest', async () => {
		const props = createProps();
		const onlyGuest = makeGuest({
			guestId: 'g-only',
			fullName: 'Solo Invitado',
			phone: '6691111111',
		});
		const updatedGuest = makeGuest({ ...onlyGuest, waShareUrl: 'https://wa.me/526691111111' });

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
					templates={DEFAULT_TEMPLATES}
					shareDateContext={{
						eventDate: '',
						daysUntilEvent: '',
						rsvpDeadline: '',
						eventTimingText: '',
						rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
					}}
					eventTitle="Test Event"
				/>
			);
		};

		props.onSave.mockResolvedValue(updatedGuest);
		props.onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Solo Invitado')).toBeInTheDocument();
		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(
				screen.getByText('No hay invitaciones pendientes por enviar.'),
			).toBeInTheDocument();
		});
	});

	it('fallback "Copiar invitación" copies URL without marking sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar invitación'));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('fallback "Copiar y marcar como enviada" copies URL, marks sent, and advances', async () => {
		window.open = jest.fn().mockReturnValue(null);
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
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

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => expect(screen.getByText('Mantener pendiente')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Mantener pendiente'));

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('onMarkShared failure during WhatsApp flow shows fallback error', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }));
		props.onSave.mockResolvedValue(makeGuest({ guestId: 'guest-1' }));
		props.onMarkShared.mockRejectedValue(new Error('Mark failed'));

		goToMessageStep();
		await waitFor(() => {
			expect(
				screen.getByRole('button', { name: /enviar por whatsapp/i }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole('button', { name: /enviar por whatsapp/i }));

		await waitFor(() => {
			expect(screen.getByText('Error al registrar el envío.')).toBeInTheDocument();
		});
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});
});
