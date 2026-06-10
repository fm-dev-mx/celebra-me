import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShareMessagesModal from '@/components/dashboard/guests/ShareMessagesModal';
import { guestsApi } from '@/lib/dashboard/guests-api';

jest.mock('@/lib/dashboard/guests-api', () => ({
	guestsApi: {
		updateShareMessages: jest.fn(),
	},
}));

jest.mock('@/components/dashboard/ModalShell', () => {
	return {
		__esModule: true,
		default: ({
			title,
			onClose,
			children,
		}: {
			title: string;
			onClose: () => void;
			children: React.ReactNode;
		}) => (
			<div role="dialog" aria-label={title}>
				<button onClick={onClose}>Cerrar</button>
				{children}
			</div>
		),
	};
});

const initialTemplates = {
	invitation: 'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}',
	reminder:
		'Hola {guestName}, te comparto nuevamente tu invitación a {eventTitle}:\n\n{inviteUrl}',
};

function createModal(overrides: Record<string, unknown> = {}) {
	const onClose = jest.fn();
	const onSave = jest.fn();

	render(
		<ShareMessagesModal
			eventId="evt-1"
			eventTitle="XV Años"
			initialTemplates={initialTemplates}
			onClose={onClose}
			shareDateContext={{
				eventDate: '',
				daysUntilEvent: '',
				rsvpDeadline: '',
				eventTimingText: '',
				rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
			}}
			onSave={onSave}
			{...overrides}
		/>,
	);

	return { onClose, onSave };
}

describe('ShareMessagesModal', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders with the correct title', () => {
		createModal();
		expect(
			screen.getByRole('dialog', { name: /mensajes para compartir/i }),
		).toBeInTheDocument();
	});

	it('does not render the shared link description field', () => {
		createModal();
		expect(
			screen.queryByLabelText(/descripci.n del enlace compartido/i),
		).not.toBeInTheDocument();
	});

	it('renders with invitation tab active by default', () => {
		createModal();
		const tab = screen.getByRole('tab', { name: /invitación/i });
		expect(tab).toHaveAttribute('aria-selected', 'true');
	});

	it('shows tabpanel with textarea for invitation message', () => {
		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		expect(textarea).toHaveValue(initialTemplates.invitation);
	});

	it('switches to reminder tab on click', () => {
		createModal();
		fireEvent.click(screen.getByRole('tab', { name: /recordatorio/i }));
		expect(screen.getByRole('tab', { name: /recordatorio/i })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		expect(screen.getByLabelText(/mensaje de recordatorio/i)).toHaveValue(
			initialTemplates.reminder,
		);
	});

	it('updates character count as user types', () => {
		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Hola' } });
		expect(screen.getByText('4/500')).toBeInTheDocument();
	});

	it('calls onSave with API result when save button is clicked', async () => {
		const updatedTemplates = {
			invitation: 'Custom invitation',
			reminder: 'Custom reminder',
		};
		(guestsApi.updateShareMessages as jest.Mock).mockResolvedValue(updatedTemplates);

		const { onSave } = createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Custom invitation' } });

		fireEvent.click(screen.getByText('Guardar'));

		await waitFor(() => {
			expect(guestsApi.updateShareMessages).toHaveBeenCalledWith('evt-1', {
				invitation: 'Custom invitation',
				reminder: initialTemplates.reminder,
			});
			expect(onSave).toHaveBeenCalledWith(updatedTemplates);
		});
	});

	it('disables save button when no changes made', () => {
		createModal();
		expect(screen.getByText('Guardar')).toBeDisabled();
	});

	it('disables save button while saving', async () => {
		(guestsApi.updateShareMessages as jest.Mock).mockImplementation(
			() => new Promise(() => {}),
		);

		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Edited' } });

		fireEvent.click(screen.getByText('Guardar'));

		expect(screen.getByText('Guardando...')).toBeDisabled();
	});

	it('shows error message when save fails', async () => {
		(guestsApi.updateShareMessages as jest.Mock).mockRejectedValue(new Error('Network error'));

		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Custom invitation' } });

		await act(async () => {
			fireEvent.click(screen.getByText('Guardar'));
		});

		expect(screen.getByText('Network error')).toBeInTheDocument();
	});

	it('resets to default templates on reset click with two-click confirmation', () => {
		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Custom text' } });

		fireEvent.click(screen.getByText('Restablecer predeterminados'));
		fireEvent.click(screen.getByText('¿Restablecer?'));

		expect(textarea).toHaveValue(
			'Hola {guestName}, te comparto tu invitación a {eventTitle}:\n\n{inviteUrl}\n\nÁbrela para ver los detalles y confirmar tu asistencia.',
		);
	});

	it('cancel reset does not reset templates', () => {
		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Custom text' } });

		fireEvent.click(screen.getByText('Restablecer predeterminados'));
		fireEvent.click(screen.getByText('Cancelar'));

		expect(textarea).toHaveValue('Custom text');
	});

	it('shows preview of the invitation message', () => {
		createModal();
		const textarea = screen.getByLabelText(/mensaje de invitación/i);
		fireEvent.change(textarea, { target: { value: 'Hola {guestName}!' } });

		expect(screen.getByText('Hola María García!')).toBeInTheDocument();
	});

	it('calls onClose when cancel is clicked', () => {
		const { onClose } = createModal();
		fireEvent.click(screen.getByText('Cancelar'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('shows available variables for the template', () => {
		createModal();
		expect(screen.getByText('{guestName}')).toBeInTheDocument();
		expect(screen.getByText('{eventTitle}')).toBeInTheDocument();
		expect(screen.getByText('{inviteUrl}')).toBeInTheDocument();
	});
});
