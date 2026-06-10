import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
		inviteUrl: 'http://localhost/invitacion/invite-1',
		inviteBaseUrl: 'http://localhost',
		onClose: jest.fn(),
		onSave: jest.fn(),
		onMarkShared: jest.fn(),
		onAdvanceFromGuest: jest.fn(),
		onPostponeGuest: jest.fn(),
	};
}

function getMessageTextarea(): HTMLTextAreaElement {
	const textareas = screen.getAllByRole('textbox');
	return textareas[textareas.length - 1] as HTMLTextAreaElement;
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

function clearNavigatorAPIs() {
	const nav = navigator as unknown as Record<string, unknown>;
	delete nav.share;
	delete nav.clipboard;
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
	it('renders guest name, max attendees, and phone fields', () => {
		renderModal(makeGuest());

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByDisplayValue('6691234567')).toBeInTheDocument();
	});

	it('shows empty state when guest is null', () => {
		renderModal(null);

		expect(screen.getByText('No hay invitaciones pendientes por enviar.')).toBeInTheDocument();
	});

	it('shows message preview on the single screen', () => {
		renderModal(makeGuest({ fullName: 'María García' }));

		expect(screen.getByText(/Hola María García/)).toBeInTheDocument();
		expect(screen.getByText(/Test Event/)).toBeInTheDocument();
	});

	it('shows Compartir button as primary CTA', () => {
		renderModal(makeGuest({ phone: '6691234567' }));

		expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
	});

	it('shows WhatsApp icon with Compartir when phone is available', () => {
		renderModal(makeGuest({ phone: '6691234567' }));

		const btn = screen.getByRole('button', { name: /compartir/i });

		const whatsappIcon = btn.querySelector('svg');
		expect(whatsappIcon).toBeInTheDocument();
	});

	it('shows Compartir without WhatsApp icon when phone is missing', () => {
		renderModal(makeGuest({ phone: '', waShareUrl: '' }));

		expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
	});

	it('shows Copiar mensaje as secondary action', () => {
		renderModal(makeGuest());

		expect(screen.getByRole('button', { name: /copiar mensaje/i })).toBeInTheDocument();
	});

	it('shows message preview with Mensaje a enviar label', () => {
		renderModal(makeGuest());

		expect(screen.getByText('Mensaje a enviar')).toBeInTheDocument();
	});

	it('shows Editar mensaje button', () => {
		renderModal(makeGuest());

		expect(screen.getByText('Editar mensaje')).toBeInTheDocument();
	});

	it('toggles to textarea when edit is clicked', () => {
		renderModal(makeGuest());

		fireEvent.click(screen.getByText('Editar mensaje'));

		expect(getMessageTextarea()).toBeInTheDocument();
	});

	it('reset from template reverts textarea to template-generated message without exiting edit mode', () => {
		renderModal(makeGuest({ fullName: 'Test Person' }));

		fireEvent.click(screen.getByText('Editar mensaje'));

		const textarea = getMessageTextarea();
		fireEvent.change(textarea, { target: { value: 'Custom edit' } });

		fireEvent.click(screen.getByText('Restablecer desde plantilla'));

		const resetTextarea = getMessageTextarea();
		expect(resetTextarea.value).toContain('Hola Test Person');
	});

	it('cancel edit returns to preview with original template message', () => {
		renderModal(makeGuest({ fullName: 'Test Person' }));

		fireEvent.click(screen.getByText('Editar mensaje'));
		const textarea = getMessageTextarea();
		fireEvent.change(textarea, { target: { value: 'Edited text' } });

		fireEvent.click(screen.getByText('Cancelar edición'));

		expect(screen.getByText('Editar mensaje')).toBeInTheDocument();
	});

	it('blocks empty message on edit and shows error', async () => {
		const { props } = renderModal(makeGuest({ phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByText('Editar mensaje'));
		const textarea = getMessageTextarea();
		fireEvent.change(textarea, { target: { value: '' } });

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(screen.getByText('El mensaje no puede estar vacío.')).toBeInTheDocument();
		});
		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('reset from template restores template content in textarea', async () => {
		const { props } = renderModal(makeGuest({ phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByText('Editar mensaje'));
		const textarea = getMessageTextarea();
		fireEvent.change(textarea, { target: { value: '' } });

		fireEvent.click(screen.getByText('Restablecer desde plantilla'));

		const restoredTextarea = getMessageTextarea();
		expect(restoredTextarea.value).toContain('Hola Guest One');
	});

	it('blocks submit with invalid non-empty phone and shows corrected error', async () => {
		const { props } = renderModal(makeGuest({ phone: '123' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			const errors = screen.getAllByText(
				'Revisa el número de WhatsApp o déjalo vacío para elegir el contacto manualmente.',
			);
			expect(errors.length).toBeGreaterThanOrEqual(1);
		});

		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('allows sharing with empty phone (no validation error)', async () => {
		const { props } = renderModal(makeGuest({ phone: '', waShareUrl: '' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '', waShareUrl: '' }));
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/wa\.me\/\?text/),
				'_blank',
				'noopener,noreferrer',
			);
		});
	});

	it('WhatsApp flow with valid phone: opens WhatsApp, marks shared, and advances', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }));
		props.onSave.mockResolvedValue(makeGuest({ fullName: 'Guest One Updated' }));
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() =>
			expect(window.open).toHaveBeenCalledWith(
				expect.stringContaining('wa.me/526691234567'),
				'_blank',
				'noopener,noreferrer',
			),
		);

		await waitFor(() =>
			expect(props.onMarkShared).toHaveBeenCalledWith(
				expect.objectContaining({ guestId: 'guest-1' }),
			),
		);
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('WhatsApp popup blocked shows fallback without marking sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		clearNavigatorAPIs();
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('no-phone flow: opens WhatsApp contact chooser, then copies and marks shared', async () => {
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

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() =>
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/wa\.me\/\?text=/),
				'_blank',
				'noopener,noreferrer',
			),
		);
		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('save-not-called when guest data unchanged', async () => {
		const guest = makeGuest({ guestId: 'guest-1' });
		const { props } = renderModal(guest);
		props.onSave.mockResolvedValue(guest);
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('save-called when guest name is edited', async () => {
		const guest = makeGuest({ guestId: 'guest-1', fullName: 'Original Name' });
		const { props } = renderModal(guest);
		props.onSave.mockResolvedValue(makeGuest({ guestId: 'guest-1', fullName: 'Edited Name' }));
		props.onMarkShared.mockResolvedValue(undefined);

		const nameInput = screen.getByDisplayValue('Original Name');
		fireEvent.change(nameInput, { target: { value: 'Edited Name' } });

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() =>
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited Name',
				maxAllowedAttendees: 4,
				phone: '6691234567',
				countryCode: '+52',
			}),
		);
	});

	it('copiar mensaje copies message and marks shared (without requiring save)', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));
		props.onSave.mockResolvedValue(
			makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }),
		);
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /copiar mensaje/i }));

		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('fallback "Copiar invitación" copies URL without marking sent', async () => {
		window.open = jest.fn().mockReturnValue(null);
		clearNavigatorAPIs();
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar invitación'));

		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('fallback "Copiar y marcar como enviada" copies URL, marks sent, and advances', async () => {
		window.open = jest.fn().mockReturnValue(null);
		clearNavigatorAPIs();
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => expect(screen.getByText('Copiar invitación')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Copiar y marcar como enviada'));

		await waitFor(() => expect(props.onMarkShared).toHaveBeenCalled());
		await waitFor(() => expect(props.onAdvanceFromGuest).toHaveBeenCalledWith('guest-1'));
	});

	it('fallback "Mantener pendiente" returns to form phase without advancing', async () => {
		window.open = jest.fn().mockReturnValue(null);
		clearNavigatorAPIs();
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => expect(screen.getByText('Mantener pendiente')).toBeInTheDocument());

		fireEvent.click(screen.getByText('Mantener pendiente'));

		expect(screen.getByDisplayValue('Guest One')).toBeInTheDocument();
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

	it('Cancelar closes modal without marking shared or advancing', () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1' }));

		fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

		expect(props.onClose).toHaveBeenCalled();
		expect(props.onMarkShared).not.toHaveBeenCalled();
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('cancel edit does not trigger onSave', async () => {
		const { props } = renderModal(makeGuest());
		props.onSave.mockResolvedValue(makeGuest());

		fireEvent.click(screen.getByText('Editar mensaje'));
		const textarea = getMessageTextarea();
		fireEvent.change(textarea, { target: { value: 'Custom message' } });

		fireEvent.click(screen.getByText('Cancelar edición'));

		expect(props.onSave).not.toHaveBeenCalled();
	});

	it('saves with phone payload when phone is valid and data changed', async () => {
		const guest = makeGuest({ guestId: 'guest-1', phone: '6691234567', fullName: 'Original' });
		const { props } = renderModal(guest);
		props.onSave.mockResolvedValue(makeGuest({ phone: '6691234567' }));

		const nameInput = screen.getByDisplayValue('Original');
		fireEvent.change(nameInput, { target: { value: 'Edited' } });

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited',
				maxAllowedAttendees: 4,
				phone: '6691234567',
				countryCode: '+52',
			});
		});
	});

	it('saves with null phone when phone field is cleared', async () => {
		const guest = makeGuest({ guestId: 'guest-1', phone: '6691234567', fullName: 'Original' });
		const { props } = renderModal(guest);
		props.onSave.mockResolvedValue(makeGuest({ phone: '' }));

		const nameInput = screen.getByDisplayValue('Original');
		fireEvent.change(nameInput, { target: { value: 'Edited' } });
		const phoneInput = screen.getByRole('textbox', { name: /Teléfono/ });
		fireEvent.change(phoneInput, { target: { value: '' } });

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(props.onSave).toHaveBeenCalledWith('guest-1', {
				fullName: 'Edited',
				maxAllowedAttendees: 4,
				phone: null,
				countryCode: undefined,
			});
		});
	});

	it('advances to next pending guest after sending current one', async () => {
		const props = createProps();
		const GuestA = makeGuest({ guestId: 'g-a', fullName: 'Ana López', phone: '6691111111' });
		const GuestB = makeGuest({ guestId: 'g-b', fullName: 'María García', phone: '6692222222' });

		const Wrapper = () => {
			const [guest, setGuest] = useState<ReturnType<typeof makeGuest> | null>(GuestA);
			return (
				<SendInvitationModal
					key={guest?.guestId ?? 'empty'}
					guest={guest}
					pendingGuests={[GuestA, GuestB]}
					inviteUrl={createProps().inviteUrl}
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

		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Ana López')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

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

		const Wrapper = () => {
			const [guest, setGuest] = useState<ReturnType<typeof makeGuest> | null>(onlyGuest);
			return (
				<SendInvitationModal
					key={guest?.guestId ?? 'empty'}
					guest={guest}
					pendingGuests={guest ? [guest] : []}
					inviteUrl={createProps().inviteUrl}
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

		props.onSave.mockResolvedValue(makeGuest());
		props.onMarkShared.mockResolvedValue(undefined);

		render(<Wrapper />);

		expect(screen.getByDisplayValue('Solo Invitado')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(
				screen.getByText('No hay invitaciones pendientes por enviar.'),
			).toBeInTheDocument();
		});
	});

	it('onMarkShared failure during WhatsApp flow shows fallback error', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', fullName: 'Guest One' }));
		props.onSave.mockResolvedValue(makeGuest({ guestId: 'guest-1' }));
		props.onMarkShared.mockRejectedValue(new Error('Mark failed'));

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(screen.getByText('Error al registrar el envío.')).toBeInTheDocument();
		});
		expect(props.onAdvanceFromGuest).not.toHaveBeenCalled();
	});

	it('shows hint text when phone field is empty', () => {
		renderModal(makeGuest({ phone: '' }));

		expect(
			screen.getByText(
				'Sin teléfono registrado. Al compartir, WhatsApp te permitirá elegir el contacto.',
			),
		).toBeInTheDocument();
	});

	it('shows no hint text when phone field has a value', () => {
		renderModal(makeGuest({ phone: '6691234567' }));

		expect(
			screen.queryByText(
				'Sin teléfono registrado. Al compartir, WhatsApp te permitirá elegir el contacto.',
			),
		).not.toBeInTheDocument();
	});

	it('does not show Posponer in single mode', () => {
		renderModal(makeGuest({ guestId: 'guest-1' }), [makeGuest({ guestId: 'guest-1' })], {
			inviteUrl: 'http://localhost/invitacion/invite-1',
		});

		const postponeBtn = screen.queryByRole('button', { name: /posponer/i });
		expect(postponeBtn).not.toBeInTheDocument();
	});

	it('WhatsApp URL uses wa.me/?text= when no phone', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '', waShareUrl: '' }));
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/^https:\/\/wa\.me\/\?text=/),
				'_blank',
				'noopener,noreferrer',
			);
		});
	});

	it('WhatsApp URL uses wa.me/{phone} when phone is valid', async () => {
		const { props } = renderModal(makeGuest({ guestId: 'guest-1', phone: '6691234567' }));
		props.onMarkShared.mockResolvedValue(undefined);

		fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

		await waitFor(() => {
			expect(window.open).toHaveBeenCalledWith(
				expect.stringMatching(/^https:\/\/wa\.me\/526691234567\?text=/),
				'_blank',
				'noopener,noreferrer',
			);
		});
	});
});
