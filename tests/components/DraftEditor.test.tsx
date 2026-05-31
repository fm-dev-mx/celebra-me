import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DraftEditor from '@/components/dashboard/intake/DraftEditor';

const mockUpdateDraft = jest.fn();
let mockSaving = false;

jest.mock('@/hooks/use-invitation-admin', () => ({
	useInvitationAdmin: () => ({
		updateDraft: mockUpdateDraft,
		saving: mockSaving,
	}),
}));

const hero = {
	name: 'Ana Sofia',
	secondaryName: '',
	label: 'Mis XV Anos',
	nickname: 'Anita',
	date: '2027-11-20T18:00:00Z',
};

const family = {
	fatherName: 'Fernando Valenzuela',
	fatherDeceased: false,
	motherName: 'Maria Duarte',
	motherDeceased: false,
	spouseName: '',
	godparents: 'Arturo Valenzuela — Padrino\nLucia Duarte — Madrina',
	children: '',
	sectionMessage: 'Nuestra familia te recibe con alegria',
};

const content = {
	title: 'XV Anos — Ana Sofia',
	description: 'Una noche magica',
	hero,
	family,
	location: {
		ceremony: {
			venueName: 'Parroquia del Sagrado Corazon',
			address: 'Av. de las Rosas 240',
			city: 'Queretaro',
			date: '2027-11-20',
			time: '18:00',
			mapUrl: '',
		},
		reception: {
			venueName: 'Salon Imperial',
			address: 'Paseo del Palacio 18',
			city: 'Queretaro',
			date: '2027-11-20',
			time: '20:00',
			mapUrl: '',
		},
		dressCode: 'Formal de gala',
		additionalIndications: '',
	},
	rsvp: {
		title: 'Confirma tu asistencia',
		guestCap: 4,
		confirmationMessage: 'Gracias por confirmar',
		confirmationMode: 'api',
		whatsappPhone: '',
		subcopy: '',
	},
	music: {
		url: 'https://example.com/cancion.mp3',
		title: 'Nuvole Bianche',
	},
	gifts: {
		title: 'Mesa de regalos',
		subtitle: 'Tu presencia es el mejor regalo',
	},
	quote: {
		text: 'Entre rosas y luz de velas',
		author: 'Ana Sofia',
	},
	thankYou: {
		message: 'Gracias por compartir esta noche',
		closingName: 'Ana Sofia Valenzuela',
	},
	photoNotes: {
		whatsappSent: true,
		heroPhoto: 'Foto de Ana Sofia en el jardin',
		portraitPhoto: 'Retrato formal de estudio',
		galleryPhotos: '',
		familyPhoto: '',
		specialPhoto: '',
		generalNotes: 'Prefieren tonos calidos',
	},
};

const defaultProps = {
	projectId: 'proj-1',
	initialContent: content,
	onCancel: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	mockSaving = false;
	mockUpdateDraft.mockResolvedValue({ draft: { content } });
});

describe('DraftEditor', () => {
	it('renders existing draft values', () => {
		render(<DraftEditor {...defaultProps} />);

		const anaSofiaInputs = screen.getAllByDisplayValue('Ana Sofia');
		expect(anaSofiaInputs.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByDisplayValue('XV Anos — Ana Sofia')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Mis XV Anos')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Anita')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Fernando Valenzuela')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Maria Duarte')).toBeInTheDocument();
	});

	it('editing a text field updates local state', () => {
		render(<DraftEditor {...defaultProps} />);

		const titleInput = screen.getByDisplayValue('XV Anos — Ana Sofia');
		fireEvent.change(titleInput, { target: { value: 'Nuevo Titulo' } });

		expect(titleInput).toHaveValue('Nuevo Titulo');
	});

	it('toggle checkbox updates local state', () => {
		render(<DraftEditor {...defaultProps} />);

		const fatherDeceased = screen.getByLabelText('Padre fallecido');
		expect(fatherDeceased).not.toBeChecked();
		fireEvent.click(fatherDeceased);
		expect(fatherDeceased).toBeChecked();
	});

	it('cancel exits without saving', () => {
		const onCancel = jest.fn();
		render(<DraftEditor {...defaultProps} onCancel={onCancel} />);

		const titleInput = screen.getByDisplayValue('XV Anos — Ana Sofia');
		fireEvent.change(titleInput, { target: { value: 'Changed' } });
		fireEvent.click(screen.getByText('Cancelar'));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(mockUpdateDraft).not.toHaveBeenCalled();
	});

	it('save calls update action with preserved content', async () => {
		mockUpdateDraft.mockResolvedValue({ draft: { content } });
		render(<DraftEditor {...defaultProps} />);

		fireEvent.click(screen.getByText('Guardar cambios'));

		await waitFor(() => {
			expect(mockUpdateDraft).toHaveBeenCalledWith(
				'proj-1',
				expect.objectContaining({
					title: 'XV Anos — Ana Sofia',
					hero: expect.objectContaining({ name: 'Ana Sofia' }),
					family: expect.objectContaining({ fatherName: 'Fernando Valenzuela' }),
				}),
			);
		});
	});

	it('save success feedback appears', async () => {
		render(<DraftEditor {...defaultProps} />);

		fireEvent.click(screen.getByText('Guardar cambios'));

		expect(await screen.findByText('Borrador guardado exitosamente.')).toBeInTheDocument();
	});

	it('shows Cerrar button after successful save', async () => {
		render(<DraftEditor {...defaultProps} />);

		fireEvent.click(screen.getByText('Guardar cambios'));

		expect(await screen.findByText('Cerrar')).toBeInTheDocument();
		expect(screen.queryByText('Guardar cambios')).not.toBeInTheDocument();
		expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
	});

	it('Cerrar button exits edit mode after save', async () => {
		const onCancel = jest.fn();
		render(<DraftEditor {...defaultProps} onCancel={onCancel} />);

		fireEvent.click(screen.getByText('Guardar cambios'));
		fireEvent.click(await screen.findByText('Cerrar'));

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('error state renders in Spanish', async () => {
		mockUpdateDraft.mockRejectedValue(new Error('Error de prueba'));
		render(<DraftEditor {...defaultProps} />);

		fireEvent.click(screen.getByText('Guardar cambios'));

		expect(await screen.findByText('Error de prueba')).toBeInTheDocument();
	});

	it('editing is disabled while saving', () => {
		mockSaving = true;
		render(<DraftEditor {...defaultProps} />);

		const saveButton = screen.getByText('Guardando...');
		expect(saveButton).toBeDisabled();

		const cancelButton = screen.getByText('Cancelar');
		expect(cancelButton).toBeDisabled();
	});

	it('renders number field with numeric value', () => {
		render(<DraftEditor {...defaultProps} />);

		const guestCapInput = screen.getByDisplayValue('4');
		expect(guestCapInput).toHaveAttribute('type', 'number');
	});

	it('renders boolean checkbox fields', () => {
		render(<DraftEditor {...defaultProps} />);

		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes.length).toBeGreaterThanOrEqual(3);
	});

	it('renders textarea for multiline content', () => {
		render(<DraftEditor {...defaultProps} />);

		const godparentsTextarea = screen.getByDisplayValue(/Arturo Valenzuela/);
		expect(godparentsTextarea.tagName).toBe('TEXTAREA');
	});

	it('renders section titles in Spanish', () => {
		render(<DraftEditor {...defaultProps} />);

		expect(
			screen.getByRole('heading', { name: 'Datos principales / Hero' }),
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Familia' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Fecha y ubicaciones' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'Confirmación de asistencia' }),
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Música de fondo' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Regalos' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Mensajes especiales' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Notas de fotografías' })).toBeInTheDocument();
	});
});
