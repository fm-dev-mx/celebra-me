import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvitationEditor, {
	formatPublishErrorMessage,
	getCriticalSections,
} from '@/components/dashboard/intake/editor/InvitationEditor';
import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';

let saveSection: jest.Mock;
let saveMetadata: jest.Mock;
const publish = jest.fn();
const reconcileRsvp = jest.fn();
const restorePublished = jest.fn();

function createContext(
	overrides?: Partial<InvitationEditorContextDTO>,
): InvitationEditorContextDTO {
	return {
		invitation: {
			id: 'proj-1',
			kind: 'client',
			sourceInvitationId: null,
			slug: 'ana',
			title: 'XV Ana',
			eventType: 'xv',
			status: 'published',
			baseDemoId: 'demo-xv-jewelry-box',
			themeId: 'jewelry-box',
			clientName: 'Ana',
			clientEmail: '',
			clientWhatsapp: '',
			photosReceived: true,
			archivedAt: null,
			createdAt: '2026-05-30T00:00:00Z',
			updatedAt: '2026-05-30T01:00:00Z',
			rsvpSectionHasContent: false,
			snapshot: { previewSlug: 'demo-xv-jewelry-box' },
		},
		assetLookupSlug: 'demo-xv-jewelry-box',
		content: {
			title: 'XV Ana',
			description: 'Celebremos juntos',
			hero: { name: 'Ana', date: '2027-01-01' },
			countdown: {
				title: 'Ya casi celebramos',
				subtitlePrefix: 'Será el',
				footerText: 'Trae tus mejores pasos',
			},
			quote: { text: 'Un sueño comienza', author: 'Ana' },
			thankYou: { message: 'Gracias por acompañarme', closingName: 'Ana' },
			gallery: { title: 'Galería', items: [] },
			itinerary: {
				title: 'Programa',
				items: [{ icon: 'church', label: 'Ceremonia', time: '18:00' }],
			},
			gifts: { items: [{ type: 'cash', title: 'Sobres', text: '' }] },
			sectionOrder: [
				'quote',
				'family',
				'gallery',
				'countdown',
				'location',
				'itinerary',
				'rsvp',
				'gifts',
				'thankYou',
			],
		},
		draftUpdatedAt: '2026-05-30T02:00:00Z',
		draftStatus: 'approved',
		publication: {
			hasPublishedContent: true,
			version: 1,
			publishedAt: '2026-05-30T02:00:00Z',
			hasUnpublishedChanges: false,
		},
		rsvpLink: { status: 'linked', eventId: 'event-1' },
		contentSource: 'draft',
		sectionStates: {
			title: 'draft',
			description: 'draft',
			hero: 'draft',
			countdown: 'draft',
			family: 'empty',
			location: 'empty',
			itinerary: 'draft',
			rsvp: 'empty',
			music: 'empty',
			gifts: 'empty',
			quote: 'draft',
			thankYou: 'draft',
			gallery: 'draft',
			photoNotes: 'empty',
			sectionOrder: 'draft',
		},
		...overrides,
	};
}

let mockContext: InvitationEditorContextDTO;

function mockMatchMedia(matches: boolean) {
	window.matchMedia = jest.fn().mockImplementation((query: string) => ({
		matches,
		media: query,
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	}));
}

jest.mock('@/hooks/use-invitation-editor', () => ({
	useInvitationEditor: () => ({
		context: mockContext,
		publishing: false,
		reconciling: false,
		savingSection: null,
		saveSection,
		saveMetadata,
		publish,
		reconcileRsvp,
		restorePublished,
		restoring: false,
	}),
}));

jest.mock('@/lib/intake/use-asset-library', () => ({
	useAssetLibrary: () => ({
		assets: [],
		loading: false,
		error: '',
		refresh: jest.fn(),
	}),
}));

jest.mock('@/components/dashboard/intake/editor/AssetPicker', () => {
	return function MockAssetPicker({
		onSelect,
		onClose,
	}: {
		onSelect: (assetId: string) => void;
		onClose: () => void;
	}) {
		return (
			<div data-testid="mock-asset-picker">
				<button
					onClick={() => {
						onSelect('test-asset-id');
						onClose();
					}}
				>
					Select Test Asset
				</button>
				<button onClick={onClose}>Close</button>
			</div>
		);
	};
});

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		json: async () => ({ assets: [] }),
	} as Response);
	saveSection = jest.fn().mockResolvedValue({ draftUpdatedAt: '2026-05-30T03:00:00Z' });
	saveMetadata = jest.fn().mockResolvedValue(createContext().invitation);
	mockContext = createContext();
	mockMatchMedia(true);
});

describe('getCriticalSections', () => {
	it('keeps critical sections keyed by content section, not editor card id', () => {
		const result = getCriticalSections('xv', true);

		expect(result.has('hero')).toBe(true);
		expect(result.has('location')).toBe(true);
		expect(result.has('family')).toBe(true);
		expect(result.has('rsvp')).toBe(true);
		expect(result.has('main')).toBe(false);
	});
});

describe('formatPublishErrorMessage', () => {
	it('replaces server field paths with Spanish editor labels', () => {
		const result = formatPublishErrorMessage(new Error('Campos: hero.name, location.date.'));

		expect(result).toContain('Datos principales');
		expect(result).toContain('Fecha y ubicaciones');
	});
});

describe('InvitationEditor', () => {
	it('renders one selected editor section at a time', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(
			screen.getByRole('heading', { level: 2, name: 'Datos principales' }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { level: 2, name: 'Galería' }),
		).not.toBeInTheDocument();

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Galería' }));

		expect(screen.getByRole('heading', { level: 2, name: 'Galería' })).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { level: 2, name: 'Datos principales' }),
		).not.toBeInTheDocument();
	});

	it('splits Frase and Agradecimiento into separate visible editor sections', () => {
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });

		fireEvent.click(within(nav).getByRole('button', { name: 'Frase' }));
		const quoteCard = screen
			.getByRole('heading', { level: 2, name: 'Frase' })
			.closest('.invitation-editor__card') as HTMLElement;
		expect(quoteCard).toBeInTheDocument();
		expect(quoteCard.querySelector('textarea')).toHaveValue('Un sueño comienza');
		expect(
			screen.queryByRole('heading', { level: 2, name: 'Agradecimiento' }),
		).not.toBeInTheDocument();

		fireEvent.click(within(nav).getByRole('button', { name: 'Agradecimiento' }));
		const thankYouCard = screen
			.getByRole('heading', { level: 2, name: 'Agradecimiento' })
			.closest('.invitation-editor__card') as HTMLElement;
		expect(thankYouCard).toBeInTheDocument();
		expect(thankYouCard.querySelector('textarea')).toHaveValue('Gracias por acompañarme');
		expect(screen.queryByRole('heading', { level: 2, name: 'Frase' })).not.toBeInTheDocument();
	});

	it('updates preview hash from registry selection', () => {
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });

		fireEvent.click(within(nav).getByRole('button', { name: 'Frase' }));
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0#quote-section',
		);

		fireEvent.click(within(nav).getByRole('button', { name: 'Agradecimiento' }));
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0#thank-you-section',
		);
	});

	it('uses global Guardar borrador to persist dirty sections', async () => {
		render(<InvitationEditor initialContext={mockContext} />);

		fireEvent.change(screen.getByLabelText('Título público'), {
			target: { value: 'XV Ana Samantha' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'main',
				expect.objectContaining({ title: 'XV Ana Samantha' }),
				'2026-05-30T02:00:00Z',
			);
		});
		expect(screen.queryByRole('button', { name: 'Guardar sección' })).not.toBeInTheDocument();
	});

	it('edits countdown copy without moving the event date field into it', async () => {
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });

		fireEvent.click(within(nav).getByRole('button', { name: 'Cuenta regresiva' }));

		expect(
			screen.getByRole('heading', { level: 2, name: 'Cuenta regresiva' }),
		).toBeInTheDocument();
		expect(screen.getByText(/se calcula automáticamente desde la Portada/)).toBeInTheDocument();
		expect(screen.queryByLabelText('Fecha del evento')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Título')).toHaveValue('Ya casi celebramos');
		expect(screen.getByLabelText('Texto antes de la fecha')).toHaveValue('Será el');
		expect(screen.getByLabelText('Texto final')).toHaveValue('Trae tus mejores pasos');

		fireEvent.change(screen.getByLabelText('Título'), {
			target: { value: 'Falta poquito' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'countdown',
				expect.objectContaining({ title: 'Falta poquito' }),
				'2026-05-30T02:00:00Z',
			);
		});
	});

	it('focuses the persistent preview pane from the action bar on desktop', () => {
		const scrollIntoView = jest.fn();
		const originalScrollIntoView = Element.prototype.scrollIntoView;
		Element.prototype.scrollIntoView = scrollIntoView;
		const focus = jest
			.spyOn(HTMLElement.prototype, 'focus')
			.mockImplementation(() => undefined);
		const open = jest.spyOn(window, 'open').mockImplementation(() => null);

		render(<InvitationEditor initialContext={mockContext} />);
		fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));

		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(open).not.toHaveBeenCalled();

		Element.prototype.scrollIntoView = originalScrollIntoView;
		focus.mockRestore();
		open.mockRestore();
	});

	it('opens the full preview route in a new tab below the split-layout breakpoint', () => {
		mockMatchMedia(false);
		const open = jest.spyOn(window, 'open').mockImplementation(() => null);

		render(<InvitationEditor initialContext={mockContext} />);
		fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));

		expect(open).toHaveBeenCalledWith(
			'/dashboard/invitaciones/proj-1/preview?v=0',
			'_blank',
			'noopener,noreferrer',
		);
		open.mockRestore();
	});

	it('handles asset selection for hero.backgroundImageMobile', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const mobileBgLabel = screen.getByText('Fondo para móvil (opcional)');
		const field = mobileBgLabel.closest('.invitation-editor__image-field') as HTMLElement;

		// Initially shows empty state
		expect(within(field as HTMLElement).getByText('Sin imagen')).toBeInTheDocument();

		// Click to open asset picker
		fireEvent.click(within(field).getByRole('button', { name: 'Seleccionar imagen' }));
		expect(screen.getByTestId('mock-asset-picker')).toBeInTheDocument();

		// Select an asset
		fireEvent.click(screen.getByRole('button', { name: 'Select Test Asset' }));

		// Picker closes and content is updated (asset not in library → 'missing' state)
		expect(screen.queryByTestId('mock-asset-picker')).not.toBeInTheDocument();
		expect(within(field).getByText('Imagen faltante')).toBeInTheDocument();
	});
});
