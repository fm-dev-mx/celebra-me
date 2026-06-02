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
		content: {
			title: 'XV Ana',
			hero: { name: 'Ana', date: '2027-01-01' },
			gallery: { title: 'Galería', items: [] },
			itinerary: {
				title: 'Programa',
				items: [{ icon: 'church', label: 'Ceremonia', time: '18:00' }],
			},
			gifts: { items: [{ type: 'cash', title: 'Sobres', text: '' }] },
			sectionOrder: ['quote', 'gallery'],
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
			description: 'empty',
			hero: 'draft',
			family: 'empty',
			location: 'empty',
			itinerary: 'draft',
			rsvp: 'empty',
			music: 'empty',
			gifts: 'empty',
			quote: 'empty',
			thankYou: 'empty',
			gallery: 'draft',
			photoNotes: 'empty',
			sectionOrder: 'draft',
		},
		...overrides,
	};
}

beforeAll(() => {
	class MockIntersectionObserver {
		readonly root: Element | null = null;
		readonly rootMargin: string = '';
		readonly thresholds: ReadonlyArray<number> = [];
		observe() {
			/* noop */
		}
		unobserve() {
			/* noop */
		}
		disconnect() {
			/* noop */
		}
		takeRecords(): IntersectionObserverEntry[] {
			return [];
		}
	}
	Object.defineProperty(window, 'IntersectionObserver', {
		value: MockIntersectionObserver,
		writable: true,
		configurable: true,
	});
});

let mockContext: InvitationEditorContextDTO;

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

beforeEach(() => {
	jest.clearAllMocks();
	saveSection = jest.fn().mockResolvedValue({});
	saveMetadata = jest.fn().mockResolvedValue(createContext().invitation);
	mockContext = createContext();
});

describe('getCriticalSections', () => {
	it('includes hero and location for all event types', () => {
		const result = getCriticalSections('xv', false);
		expect(result.has('hero')).toBe(true);
		expect(result.has('location')).toBe(true);
	});

	it('includes family for xv, boda, bautizo event types', () => {
		expect(getCriticalSections('xv', false).has('family')).toBe(true);
		expect(getCriticalSections('boda', false).has('family')).toBe(true);
		expect(getCriticalSections('bautizo', false).has('family')).toBe(true);
	});

	it('excludes family for cumple event type', () => {
		expect(getCriticalSections('cumple', false).has('family')).toBe(false);
	});

	it('includes rsvp only when enabled', () => {
		expect(getCriticalSections('xv', false).has('rsvp')).toBe(false);
		expect(getCriticalSections('xv', true).has('rsvp')).toBe(true);
	});

	it('does not include main as a sectionStates key (hero is the canonical key)', () => {
		const result = getCriticalSections('xv', true);
		expect(result.has('main')).toBe(false);
		expect(result.has('hero')).toBe(true);
	});
});

describe('formatPublishErrorMessage', () => {
	it('replaces server field paths with section-oriented labels', () => {
		expect(formatPublishErrorMessage(new Error('Campos: hero.name, location.date.'))).toContain(
			'Datos principales',
		);
		expect(formatPublishErrorMessage(new Error('Campos: hero.name, location.date.'))).toContain(
			'Fecha y ubicaciones',
		);
	});
});

describe('InvitationEditor', () => {
	it('renders the section-based admin experience', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByRole('heading', { name: 'Datos principales' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Galería' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Publicación' })).toBeInTheDocument();
	});

	it('discards local unsaved changes and restores the loaded baseline', () => {
		jest.spyOn(window, 'confirm').mockReturnValue(true);
		render(<InvitationEditor initialContext={mockContext} />);

		const title = screen.getByLabelText('Título público');
		fireEvent.change(title, { target: { value: 'Título temporal' } });
		expect(title).toHaveValue('Título temporal');

		fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
		expect(title).toHaveValue('XV Ana');
		expect(screen.queryByText(/cambio sin guardar/)).not.toBeInTheDocument();
	});

	it('keeps photo notes inside Gallery instead of a standalone navigation destination', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		expect(within(nav).queryByText('Notas de fotografías')).not.toBeInTheDocument();
		expect(screen.getByText('Notas internas')).toBeInTheDocument();
		expect(document.querySelector('#photoNotes')).toBeNull();
	});

	it('renders Spanish display labels for stored itinerary and gift keys', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByRole('option', { name: 'Iglesia' })).toHaveValue('church');
		expect(screen.getByDisplayValue('Efectivo')).toBeInTheDocument();
	});

	it('renders compact repeated-row summaries and dense public ordering', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByText('1. Ceremonia · Iglesia · 18:00')).toBeInTheDocument();
		expect(screen.getByText('1. Frase')).toBeInTheDocument();
		expect(screen.getByText('2. Galería')).toBeInTheDocument();
	});

	it('links publish-readiness warnings to the affected editor sections', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		expect(screen.getByRole('link', { name: 'Personas principales' })).toHaveAttribute(
			'href',
			'#family',
		);
		expect(screen.getByRole('link', { name: 'Fecha y ubicaciones' })).toHaveAttribute(
			'href',
			'#location',
		);
	});

	it('renders a Spanish-friendly publication timestamp', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		const label = screen.getByText('Última publicación:');
		expect(label.parentElement?.textContent).toMatch(/\d{1,2} de mayo de 2026/);
	});

	it('opens deliberate confirmation dialogs for publish and restore-from-published', () => {
		render(<InvitationEditor initialContext={mockContext} />);

		fireEvent.click(screen.getByRole('button', { name: 'Restaurar desde versión pública' }));
		expect(
			screen.getByRole('heading', { name: 'Restaurar desde versión pública' }),
		).toBeInTheDocument();
		expect(screen.getByText(/reemplazará el borrador editable/)).toBeInTheDocument();
	});

	it('shows conservative replacement copy and preview link before publishing', () => {
		const publishReadyCtx = createContext({
			draftStatus: 'draft',
			sectionStates: Object.fromEntries(
				Object.keys(createContext().sectionStates).map((key) => [key, 'draft']),
			) as Record<string, 'draft' | 'published' | 'demo' | 'empty'>,
		});
		mockContext = publishReadyCtx;
		render(<InvitationEditor initialContext={publishReadyCtx} />);

		fireEvent.click(screen.getByRole('button', { name: 'Publicar cambios' }));
		expect(screen.getByRole('heading', { name: 'Publicar cambios' })).toBeInTheDocument();
		expect(screen.getByText(/reemplazará la versión pública actual/)).toBeInTheDocument();
		expect(screen.getByText('Secciones guardadas que se publicarán:')).toBeInTheDocument();
		expect(screen.getAllByText('Datos principales').length).toBeGreaterThan(1);
		expect(screen.getAllByRole('link', { name: 'Vista previa' }).length).toBeGreaterThan(1);
	});

	it('saves only the edited main section', async () => {
		const { container } = render(<InvitationEditor initialContext={mockContext} />);
		const mainCard = container.querySelector('#main');
		expect(mainCard).not.toBeNull();

		fireEvent.change(within(mainCard as HTMLElement).getByLabelText('Título público'), {
			target: { value: 'XV Ana Samantha' },
		});
		fireEvent.click(within(mainCard as HTMLElement).getByText('Guardar sección'));

		await waitFor(() => {
			expect(saveSection).toHaveBeenCalledWith(
				'main',
				expect.objectContaining({ title: 'XV Ana Samantha' }),
				undefined,
			);
		});
		expect(saveSection).toHaveBeenCalledTimes(1);
	});

	it('section cards have aria-labelledby pointing to section heading', () => {
		const { container } = render(<InvitationEditor initialContext={mockContext} />);
		const sections = container.querySelectorAll('.invitation-editor__card');
		expect(sections.length).toBeGreaterThan(0);
		sections.forEach((section) => {
			const labelledby = section.getAttribute('aria-labelledby');
			expect(labelledby).not.toBeNull();
			const heading = document.getElementById(labelledby!);
			expect(heading).not.toBeNull();
		});
	});

	it('nav dots have aria-label with Fuente prefix', () => {
		render(<InvitationEditor initialContext={mockContext} />);
		const nav = screen.getByRole('navigation', { name: 'Secciones del editor' });
		const dots = nav.querySelectorAll('.invitation-editor__nav-dot');
		expect(dots.length).toBeGreaterThan(0);
		dots.forEach((dot) => {
			expect(dot.getAttribute('aria-label')).toMatch(/^Fuente: /);
		});
	});

	it('nav items have active class on scroll intersection (check initial render has no active item)', () => {
		const { container } = render(<InvitationEditor initialContext={mockContext} />);
		const activeItems = container.querySelectorAll('.invitation-editor__nav-item--active');
		expect(activeItems.length).toBe(0);
	});
});
