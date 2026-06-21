import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvitationEditor, {
	formatPublishErrorMessage,
	getCriticalSections,
} from '@/components/dashboard/intake/editor/InvitationEditor';
import type { InvitationEditorContextDTO } from '@/lib/dashboard/dto/intake';
import { ApiError } from '@/lib/rsvp/core/errors';

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
			createdBy: 'user-1',
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
				footerText: 'Trae tus mejores pasos',
			},
			quote: { text: 'Un sueño comienza', author: 'Ana' },
			thankYou: { message: 'Gracias por acompañarme', closingName: 'Ana' },
			gallery: { title: 'Galería', items: [] },
			itinerary: {
				title: 'Programa',
				items: [{ iconName: 'Church', label: 'Ceremonia', time: '18:00' }],
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
		operation: { type: 'idle' },
		saveSection,
		saveMetadata,
		publish,
		reconcileRsvp,
		restorePublished,
		assignOwner: jest.fn(),
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

afterEach(() => {
	jest.restoreAllMocks();
});

beforeEach(() => {
	jest.clearAllMocks();
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

	it('renders itinerary item validation paths with item-level labels', () => {
		const result = formatPublishErrorMessage(
			new Error(
				'Campos: itinerary.items.0.iconName, itinerary.items.1.iconName, itinerary.items.2.time.',
			),
		);

		expect(result).toContain('Programa: actividad 1 icono');
		expect(result).toContain('Programa: actividad 2 icono');
		expect(result).toContain('Programa: actividad 3 hora');
		expect(result).not.toContain('Programa, Programa, Programa');
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
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=internal#quote-section',
		);

		fireEvent.click(within(nav).getByRole('button', { name: 'Agradecimiento' }));
		expect(screen.getByTitle('Vista previa de la invitación')).toHaveAttribute(
			'src',
			'/dashboard/invitaciones/proj-1/preview?embed=1&v=0&revealState=internal#thank-you-section',
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
		expect(screen.getByText(/se toma[\s\S]*automáticamente de la Portada/)).toBeInTheDocument();
		expect(screen.queryByLabelText('Fecha del evento')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Título')).toHaveValue('Ya casi celebramos');
		expect(screen.getByLabelText('Texto inferior')).toHaveValue('Trae tus mejores pasos');

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

	it('edits location section intro copy', async () => {
		mockContext = createContext({
			content: {
				...createContext().content,
				location: {
					introEyebrow: 'EL CAMINO AL PALACIO',
					introHeading: 'Ubicación',
					introLede: 'Guarda la ruta y llega con calma.',
					indicationsHeading: 'Indicaciones importantes',
				},
			},
			sectionStates: {
				...createContext().sectionStates,
				location: 'draft',
			},
		});
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });

		fireEvent.click(within(nav).getByRole('button', { name: 'Fecha y ubicaciones' }));

		expect(screen.getByLabelText('Texto superior')).toHaveValue('EL CAMINO AL PALACIO');
		expect(screen.getByLabelText('Título de sección')).toHaveValue('Ubicación');
		expect(screen.getByLabelText('Descripción de sección')).toHaveValue(
			'Guarda la ruta y llega con calma.',
		);
		expect(screen.getByLabelText('Título de indicaciones')).toHaveValue(
			'Indicaciones importantes',
		);

		fireEvent.change(screen.getByLabelText('Descripción de sección'), {
			target: { value: 'Nueva descripción de ruta.' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'location',
				expect.objectContaining({ introLede: 'Nueva descripción de ruta.' }),
				'2026-05-30T02:00:00Z',
			);
		});
	});

	it('edits all visible opening reveal fields from Sobre / apertura', async () => {
		mockContext = createContext({
			content: {
				...createContext().content,
				envelope: {
					disabled: false,
					envelopeName: 'Luna y Estrella',
					documentLabel: 'Primera Comunión',
					stampText: 'Luna y Estrella',
					stampYear: '2026',
					tooltipText: 'Abrir invitación',
					microcopy: 'Toca para abrir',
					cardLabel: 'Nuestra Primera Comunión',
					cardName: 'Luna Yamileth',
					cardSecondaryName: 'Estrella Abigail',
					cardTagline: 'Una celebración de fe',
					guestLabel: 'Con cariño para:',
					guestNameFallback: 'Familia invitada',
					sealInitials: 'L·E',
				},
			},
			sectionStates: {
				...createContext().sectionStates,
				envelope: 'draft',
			},
		});
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });

		fireEvent.click(within(nav).getByRole('button', { name: /Sobre \/ apertura/ }));

		expect(screen.getByLabelText('Nombre en el sobre (opcional)')).toHaveValue(
			'Luna y Estrella',
		);
		expect(screen.getByLabelText('Etiqueta del documento')).toHaveValue('Primera Comunión');
		expect(screen.getByLabelText('Texto del sello postal')).toHaveValue('Luna y Estrella');
		expect(screen.getByLabelText('Año del sello')).toHaveValue('2026');
		expect(screen.getByLabelText('Texto del botón')).toHaveValue('Abrir invitación');
		expect(screen.getByLabelText('Texto inferior')).toHaveValue('Toca para abrir');
		expect(screen.getByLabelText('Etiqueta de tarjeta')).toHaveValue(
			'Nuestra Primera Comunión',
		);
		expect(screen.getByLabelText('Nombre principal en tarjeta (opcional)')).toHaveValue(
			'Luna Yamileth',
		);
		expect(screen.getByLabelText('Segundo nombre en tarjeta (opcional)')).toHaveValue(
			'Estrella Abigail',
		);
		expect(screen.getByLabelText('Etiqueta de invitado')).toHaveValue('Con cariño para:');
		expect(screen.getByLabelText('Invitado genérico para vista previa')).toHaveValue(
			'Familia invitada',
		);

		fireEvent.change(screen.getByLabelText('Nombre en el sobre (opcional)'), {
			target: { value: 'Luna Yamileth y Estrella Abigail' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'envelope',
				expect.objectContaining({
					envelopeName: 'Luna Yamileth y Estrella Abigail',
					cardSecondaryName: 'Estrella Abigail',
					guestLabel: 'Con cariño para:',
				}),
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
	});

	it('handles asset selection for hero.backgroundImageMobile', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const mobileBgLabel = screen.getByText('Fondo para móvil');
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

	it('renders clear desktop and mobile hero image labels', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByText('Fondo para escritorio')).toBeInTheDocument();
		expect(
			screen.getByText('Se usa como imagen principal en pantallas grandes.'),
		).toBeInTheDocument();
		expect(screen.getByText('Fondo para móvil')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Opcional. Si no eliges una imagen móvil, se usará la imagen de escritorio.',
			),
		).toBeInTheDocument();
	});

	it('saves selected desktop and mobile hero images without collapsing refs', async () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const desktopField = screen
			.getByText('Fondo para escritorio')
			.closest('.invitation-editor__image-field') as HTMLElement;
		const mobileField = screen
			.getByText('Fondo para móvil')
			.closest('.invitation-editor__image-field') as HTMLElement;

		fireEvent.click(within(desktopField).getByRole('button', { name: 'Seleccionar imagen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Select Test Asset' }));
		fireEvent.click(within(mobileField).getByRole('button', { name: 'Seleccionar imagen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Select Test Asset' }));
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'main',
				expect.objectContaining({
					hero: expect.objectContaining({
						backgroundImage: { type: 'uploaded', assetId: 'test-asset-id' },
						backgroundImageMobile: { type: 'uploaded', assetId: 'test-asset-id' },
					}),
				}),
				'2026-05-30T02:00:00Z',
			);
		});
	});

	it('applies selection to the latest opened hero picker target', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const desktopField = screen
			.getByText('Fondo para escritorio')
			.closest('.invitation-editor__image-field') as HTMLElement;
		const mobileField = screen
			.getByText('Fondo para móvil')
			.closest('.invitation-editor__image-field') as HTMLElement;

		fireEvent.click(within(desktopField).getByRole('button', { name: 'Seleccionar imagen' }));
		fireEvent.click(within(mobileField).getByRole('button', { name: 'Seleccionar imagen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Select Test Asset' }));

		expect(within(desktopField).getByText('Sin imagen')).toBeInTheDocument();
		expect(within(mobileField).getByText('Imagen faltante')).toBeInTheDocument();
	});

	it('passes invitation.updatedAt as expectedUpdatedAt for metadata saves via Guardar borrador', async () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Datos de la invitación' }));

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Cliente Editado' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveMetadata).toHaveBeenCalledWith(
				expect.objectContaining({ clientName: 'Cliente Editado' }),
				'2026-05-30T01:00:00Z',
			);
		});
	});

	it('uses separate expectedUpdatedAt chains for section and metadata saves', async () => {
		render(<InvitationEditor initialContext={mockContext} />);

		fireEvent.change(screen.getByLabelText('Título público'), {
			target: { value: 'Título Sección Editado' },
		});

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Datos de la invitación' }));

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Cliente Editado' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'main',
				expect.anything(),
				'2026-05-30T02:00:00Z',
			);
		});

		expect(saveMetadata).toHaveBeenCalledWith(
			expect.objectContaining({ clientName: 'Cliente Editado' }),
			'2026-05-30T01:00:00Z',
		);
	});

	it('shows conflict recovery button with neutral copy when metadata save fails with conflict', async () => {
		const conflictError = new ApiError(409, 'conflict', 'Conflicto al guardar.');
		saveMetadata = jest.fn().mockRejectedValue(conflictError);

		render(<InvitationEditor initialContext={mockContext} />);

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Datos de la invitación' }));

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Cliente Conflictivo' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(
				screen.getByText(
					'Los datos cambiaron desde que abriste esta vista. Recarga para continuar.',
				),
			).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Recargar datos' })).toBeInTheDocument();
		});
	});

	it('does not show recovery button for non-conflict metadata errors', async () => {
		const badRequestError = new ApiError(422, 'bad_request', 'Revisa los campos.');
		saveMetadata = jest.fn().mockRejectedValue(badRequestError);

		render(<InvitationEditor initialContext={mockContext} />);

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Datos de la invitación' }));

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Cliente con error' },
		});

		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(screen.getByText('Revisa los campos.')).toBeInTheDocument();
		});

		expect(screen.queryByRole('button', { name: 'Recargar datos' })).not.toBeInTheDocument();
	});

	it('passes updated invitation.updatedAt from the first metadata save to the second', async () => {
		saveMetadata = jest.fn().mockImplementation(() => {
			const updatedInvitation = {
				...createContext().invitation,
				updatedAt: '2026-05-30T04:00:00Z',
			};
			mockContext = { ...mockContext, invitation: updatedInvitation };
			return Promise.resolve(updatedInvitation);
		});

		render(<InvitationEditor initialContext={mockContext} />);

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		fireEvent.click(within(nav).getByRole('button', { name: 'Datos de la invitación' }));

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Primer Cambio' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveMetadata).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(screen.queryByText('1 cambio sin guardar')).not.toBeInTheDocument();
		});

		fireEvent.change(screen.getByLabelText('Nombre del cliente'), {
			target: { value: 'Segundo Cambio' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

		await waitFor(() => {
			expect(saveMetadata).toHaveBeenCalledTimes(2);
		});

		expect(saveMetadata).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ clientName: 'Segundo Cambio' }),
			'2026-05-30T04:00:00Z',
		);
	});

	it('shows owner-required publish warning when client invitation has no owner', () => {
		mockContext = createContext({
			invitation: {
				...createContext().invitation,
				createdBy: null,
			},
		});

		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByText(/no se puede publicar sin un propietario/i)).toBeInTheDocument();
	});

	it('disables publish button when client invitation has no owner', () => {
		mockContext = createContext({
			invitation: {
				...createContext().invitation,
				createdBy: null,
			},
		});

		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled();
	});

	it('does not show owner-required warning when owner is set', () => {
		mockContext = createContext();

		render(<InvitationEditor initialContext={mockContext} />);

		expect(
			screen.queryByText(/no se puede publicar sin un propietario/i),
		).not.toBeInTheDocument();
	});

	it('shows no-draft warning for client invitations without a draft', () => {
		mockContext = createContext({
			draftStatus: null,
			contentSource: 'published',
			publication: {
				hasPublishedContent: true,
				version: 1,
				publishedAt: '',
				hasUnpublishedChanges: false,
			},
		});

		render(<InvitationEditor initialContext={mockContext} />);

		expect(
			screen.getByText(
				'Esta invitación aún no tiene un borrador. Al guardar cualquier sección se creará un borrador a partir del contenido existente.',
			),
		).toBeInTheDocument();
	});

	it('hides no-draft warning for demo invitations without a draft', () => {
		mockContext = createContext({
			invitation: {
				...createContext().invitation,
				kind: 'demo',
			},
			draftStatus: null,
			contentSource: 'published',
			publication: {
				hasPublishedContent: true,
				version: 1,
				publishedAt: '',
				hasUnpublishedChanges: false,
			},
		});

		render(<InvitationEditor initialContext={mockContext} />);

		expect(
			screen.queryByText(
				'Esta invitación aún no tiene un borrador. Al guardar cualquier sección se creará un borrador a partir del contenido existente.',
			),
		).not.toBeInTheDocument();
	});
});
