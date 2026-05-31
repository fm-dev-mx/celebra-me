import { render, screen } from '@testing-library/react';
import DraftReview from '@/components/dashboard/intake/DraftReview';

const mockLoadDraft = jest.fn();
let mockCurrentDraft: Record<string, unknown> | null = null;

let mockLoading = false;

jest.mock('@/hooks/use-invitation-admin', () => ({
	useInvitationAdmin: () => ({
		currentDraft: mockCurrentDraft,
		loading: mockLoading,
		loadDraft: mockLoadDraft,
		publishDraft: jest.fn(),
	}),
}));

function makeDraftContent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'draft-1',
		invitationProjectId: 'proj-1',
		submissionId: 'sub-1',
		status: 'draft',
		createdAt: '2026-05-28T14:00:00Z',
		updatedAt: '2026-05-28T14:00:00Z',
		content: {
			title: 'XV Anos — Ana Sofia',
			description: 'Una noche magica',
			hero: {
				name: 'Ana Sofia',
				secondaryName: '',
				label: 'Mis XV Anos',
				nickname: 'Anita',
				date: '2027-11-20T18:00:00Z',
			},
			family: {
				fatherName: 'Fernando Valenzuela',
				fatherDeceased: false,
				motherName: 'Maria Duarte',
				motherDeceased: false,
				spouseName: '',
				godparents: 'Arturo Valenzuela — Padrino\nLucia Duarte — Madrina',
				children: '',
				sectionMessage: 'Nuestra familia te recibe con alegria',
			},
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
				items: [
					{
						type: 'bank',
						title: 'Transferencia',
						bankName: 'BBVA',
						accountHolder: 'Ana Sofia',
						clabe: '012180012345678901',
					},
					{ type: 'cash', title: 'Lluvia de Sobres' },
				],
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
		},
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockCurrentDraft = null;
	mockLoading = false;
});

describe('DraftReview', () => {
	it('shows loading state while draft is loading', () => {
		mockLoading = true;
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Cargando borrador...')).toBeInTheDocument();
		expect(mockLoadDraft).toHaveBeenCalledWith('proj-1');
	});

	it('shows empty state when no draft exists', () => {
		render(<DraftReview projectId="proj-1" />);

		expect(
			screen.getByText('Aún no se ha generado un borrador para esta invitación.'),
		).toBeInTheDocument();
		expect(mockLoadDraft).toHaveBeenCalledWith('proj-1');
	});

	it('renders hero section with main data', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		const heroHeadings = screen.getAllByText('Datos principales / Hero');
		expect(heroHeadings.length).toBeGreaterThanOrEqual(1);
		const anaSofia = screen.getAllByText('Ana Sofia');
		expect(anaSofia.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('Mis XV Anos')).toBeInTheDocument();
		expect(screen.getByText('Anita')).toBeInTheDocument();
	});

	it('renders family section', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Familia')).toBeInTheDocument();
		expect(screen.getByText('Fernando Valenzuela')).toBeInTheDocument();
		expect(screen.getByText('Maria Duarte')).toBeInTheDocument();
	});

	it('renders location section with ceremony and reception', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Fecha y ubicaciones')).toBeInTheDocument();
		expect(screen.getByText('Parroquia del Sagrado Corazon')).toBeInTheDocument();
		expect(screen.getByText('Salon Imperial')).toBeInTheDocument();
	});

	it('renders RSVP section', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Confirmación de asistencia')).toBeInTheDocument();
		expect(screen.getByText('Confirma tu asistencia')).toBeInTheDocument();
		expect(screen.getByText('4')).toBeInTheDocument();
	});

	it('renders music section', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Música de fondo')).toBeInTheDocument();
		expect(screen.getByText('Nuvole Bianche')).toBeInTheDocument();
	});

	it('renders gifts section with items', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Regalos')).toBeInTheDocument();
		expect(screen.getByText('Mesa de regalos')).toBeInTheDocument();
		expect(screen.getByText('Transferencia')).toBeInTheDocument();
		expect(screen.getByText('Lluvia de Sobres')).toBeInTheDocument();
	});

	it('renders quote and thank you sections', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Mensajes especiales')).toBeInTheDocument();
		expect(screen.getByText('Entre rosas y luz de velas')).toBeInTheDocument();
		expect(screen.getByText('Agradecimiento')).toBeInTheDocument();
		expect(screen.getByText('Gracias por compartir esta noche')).toBeInTheDocument();
	});

	it('renders boolean values as Spanish labels', () => {
		mockCurrentDraft = makeDraftContent({
			content: {
				photoNotes: { whatsappSent: true },
			},
		});
		render(<DraftReview projectId="proj-1" />);

		const yesLabels = screen.getAllByText('Sí');
		expect(yesLabels.length).toBeGreaterThan(0);
	});

	it('renders photo notes section', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Notas de fotografías')).toBeInTheDocument();
		expect(screen.getByText('Prefieren tonos calidos')).toBeInTheDocument();
	});

	it('handles empty content gracefully', () => {
		mockCurrentDraft = {
			id: 'draft-empty',
			invitationProjectId: 'proj-1',
			submissionId: 'sub-1',
			status: 'draft',
			createdAt: '2026-05-28T14:00:00Z',
			updatedAt: '2026-05-28T14:00:00Z',
			content: {},
		};
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByText('Estado: draft')).toBeInTheDocument();
	});

	it('renders back link', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		const backLink = screen.getByRole('link', { name: /volver/i });
		expect(backLink).toHaveAttribute('href', '/dashboard/invitaciones/proj-1');
	});

	it('renders vista previa link pointing to preview route when status is draft', () => {
		mockCurrentDraft = makeDraftContent();
		render(<DraftReview projectId="proj-1" />);

		const previewLink = screen.getByRole('link', { name: /vista previa/i });
		expect(previewLink).toHaveAttribute('href', '/dashboard/invitaciones/proj-1/preview');
	});

	it('keeps preview available and offers a new revision when content is published', () => {
		mockCurrentDraft = makeDraftContent({ status: 'published' });
		render(<DraftReview projectId="proj-1" />);

		expect(screen.getByRole('link', { name: /vista previa/i })).toHaveAttribute(
			'target',
			'_blank',
		);
		expect(screen.getByRole('button', { name: 'Crear nueva revisión' })).toBeInTheDocument();
	});
});
