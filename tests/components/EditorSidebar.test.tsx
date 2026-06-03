import { fireEvent, render, screen, within } from '@testing-library/react';
import EditorSidebar from '@/components/dashboard/intake/editor/EditorSidebar';

function createProps(overrides?: Partial<Parameters<typeof EditorSidebar>[0]>) {
	const sectionSource = overrides?.sectionSource ?? (() => undefined);
	return {
		activeSection: '',
		savingSection: null,
		dirty: new Set<string>(),
		errors: {},
		sectionSource,
		sectionOrder: [
			'quote',
			'family',
			'gallery',
			'location',
			'itinerary',
			'rsvp',
			'gifts',
			'thankYou',
			'countdown',
		],
		onSectionOrderChange: jest.fn(),
		getSectionHasContent: () => true,
		...overrides,
	};
}

describe('EditorSidebar', () => {
	describe('group rendering', () => {
		it('renders Secciones públicas group with a heading', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Secciones públicas')).toBeInTheDocument();
		});

		it('renders Administración group with a heading', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Administración')).toBeInTheDocument();
		});
	});

	describe('admin group separation', () => {
		function getGroup(groupLabel: string): HTMLElement | null {
			const heading = screen.queryByText(groupLabel);
			return heading?.closest('.invitation-editor__nav-group') ?? null;
		}

		it('places metadata in the administration group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(getGroup('Administración')).toHaveTextContent('Datos de la invitación');
		});

		it('places publication in the administration group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(getGroup('Administración')).toHaveTextContent('Publicación');
		});

		it('places assetLibrary in the administration group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(getGroup('Administración')).toHaveTextContent('Biblioteca de imágenes');
		});

		it('does not show metadata in the public sections group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(getGroup('Secciones públicas')).not.toHaveTextContent('Datos de la invitación');
		});

		it('does not show publication in the public sections group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(getGroup('Secciones públicas')).not.toHaveTextContent('Publicación');
		});
	});

	describe('public editor surface sections', () => {
		it('renders hero as Portada in the public group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Portada')).toBeInTheDocument();
		});

		it('renders quote as Frase in the public group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Frase')).toBeInTheDocument();
		});

		it('renders location in the public group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Fecha y ubicaciones')).toBeInTheDocument();
		});
	});

	describe('hero is public-facing but not orderable', () => {
		it('renders hero without Subir/Bajar controls', () => {
			render(<EditorSidebar {...createProps()} />);
			const portada = screen
				.getByText('Portada')
				.closest('[class*="nav-item"]') as HTMLElement | null;
			const subirButtons = portada
				? within(portada).queryAllByRole('button', { name: /Subir|Bajar/i })
				: [];
			expect(subirButtons).toHaveLength(0);
		});

		it('renders hero with Requerida status', () => {
			render(<EditorSidebar {...createProps()} />);
			const statusBadges = screen.getAllByText('Requerida');
			expect(statusBadges.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('music decision', () => {
		it('renders music in the public sections group', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByText('Música')).toBeInTheDocument();
		});

		it('does not show reorder controls for music', () => {
			render(<EditorSidebar {...createProps()} />);
			const musica = screen
				.getByText('Música')
				.closest('[class*="nav-item"]') as HTMLElement | null;
			const reorderButtons = musica
				? within(musica).queryAllByRole('button', { name: /Subir|Bajar/i })
				: [];
			expect(reorderButtons).toHaveLength(0);
		});
	});

	describe('Subir / Bajar reorder controls', () => {
		it('calls onSectionOrderChange when Subir is clicked', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family', 'gallery'],
						onSectionOrderChange,
					})}
				/>,
			);
			const subirBtn = screen.getByRole('button', { name: 'Mover Familia hacia arriba' });
			fireEvent.click(subirBtn);
			expect(onSectionOrderChange).toHaveBeenCalledTimes(1);
		});

		it('calls onSectionOrderChange when Bajar is clicked', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family', 'gallery'],
						onSectionOrderChange,
					})}
				/>,
			);
			const bajarBtn = screen.getByRole('button', { name: 'Mover Familia hacia abajo' });
			fireEvent.click(bajarBtn);
			expect(onSectionOrderChange).toHaveBeenCalledTimes(1);
		});

		it('moves the section order item up when Subir is pressed', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family', 'gallery'],
						onSectionOrderChange,
					})}
				/>,
			);
			fireEvent.click(screen.getByRole('button', { name: /Mover Familia hacia arriba/ }));
			const newOrder = onSectionOrderChange.mock.calls[0][0];
			expect(newOrder).toEqual(['family', 'quote', 'gallery']);
		});
	});

	describe('reorder boundary conditions', () => {
		it('disables Subir for the first orderable section', () => {
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family'],
					})}
				/>,
			);
			const subirBtn = screen.getByRole('button', { name: /Mover Frase hacia arriba/ });
			expect(subirBtn).toBeDisabled();
		});

		it('disables Bajar for the last orderable section', () => {
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family', 'gifts'],
					})}
				/>,
			);
			const bajarBtn = screen.getByRole('button', {
				name: /Mover Mesa de regalos hacia abajo/,
			});
			expect(bajarBtn).toBeDisabled();
		});

		it('hero has no reorder controls regardless of position', () => {
			render(<EditorSidebar {...createProps()} />);
			const portada = screen
				.getByText('Portada')
				.closest('[class*="nav-item"]') as HTMLElement | null;
			const buttons = portada ? within(portada).queryAllByRole('button') : [];
			expect(buttons).toHaveLength(0);
		});
	});

	describe('visibility toggle', () => {
		it('shows Mostrar button for an Oculta section', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['location', 'gifts'],
						onSectionOrderChange,
					})}
				/>,
			);
			const mostrarBtn = screen.getByRole('button', { name: 'Mostrar Frase' });
			expect(mostrarBtn).toBeInTheDocument();
		});

		it('shows Ocultar button for a Visible section', () => {
			render(<EditorSidebar {...createProps()} />);
			const ocultarBtn = screen.getByRole('button', { name: 'Ocultar Frase' });
			expect(ocultarBtn).toBeInTheDocument();
		});

		it('calls onSectionOrderChange when toggling visible section to hidden', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'gifts'],
						onSectionOrderChange,
					})}
				/>,
			);
			fireEvent.click(screen.getByRole('button', { name: 'Ocultar Frase' }));
			expect(onSectionOrderChange).toHaveBeenCalledWith(['gifts']);
		});

		it('calls onSectionOrderChange when toggling hidden section to shown', () => {
			const onSectionOrderChange = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['gifts'],
						onSectionOrderChange,
					})}
				/>,
			);
			fireEvent.click(screen.getByRole('button', { name: 'Mostrar Frase' }));
			expect(onSectionOrderChange).toHaveBeenCalledWith(['gifts', 'quote']);
		});
	});

	describe('onSelectPublicSection callback', () => {
		it('calls onSelectPublicSection with section id when a public section label is clicked', () => {
			const onSelectPublicSection = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['quote', 'family', 'gifts'],
						onSelectPublicSection,
					})}
				/>,
			);
			fireEvent.click(screen.getByText('Frase'));
			expect(onSelectPublicSection).toHaveBeenCalledWith('quote');
		});

		it('calls onSelectPublicSection when a public section without editorCardId is clicked', () => {
			const onSelectPublicSection = jest.fn();
			render(
				<EditorSidebar
					{...createProps({
						sectionOrder: ['countdown', 'quote'],
						onSelectPublicSection,
					})}
				/>,
			);
			fireEvent.click(screen.getByText('Cuenta regresiva'));
			expect(onSelectPublicSection).toHaveBeenCalledWith('countdown');
		});

		it('does not crash when onSelectPublicSection is not provided', () => {
			render(<EditorSidebar {...createProps({ onSelectPublicSection: undefined })} />);
			fireEvent.click(screen.getByText('Frase'));
			// No crash expected
		});
	});

	describe('required sections cannot be hidden', () => {
		it('does not render a visibility toggle button for hero (required)', () => {
			render(<EditorSidebar {...createProps()} />);
			const portada = screen
				.getByText('Portada')
				.closest('[class*="nav-item"]') as HTMLElement | null;
			const buttons = portada ? within(portada).queryAllByRole('button') : [];
			const visibilityBtn = buttons.filter(
				(btn) =>
					btn.getAttribute('aria-label')?.startsWith('Ocultar') ||
					btn.getAttribute('aria-label')?.startsWith('Mostrar'),
			);
			expect(visibilityBtn).toHaveLength(0);
		});

		it('does not render a visibility toggle button for location (required)', () => {
			render(<EditorSidebar {...createProps()} />);
			const ubicacion = screen
				.getByText('Fecha y ubicaciones')
				.closest('[class*="nav-item"]') as HTMLElement | null;
			const buttons = ubicacion ? within(ubicacion).queryAllByRole('button') : [];
			const visibilityBtn = buttons.filter(
				(btn) =>
					btn.getAttribute('aria-label')?.startsWith('Ocultar') ||
					btn.getAttribute('aria-label')?.startsWith('Mostrar'),
			);
			expect(visibilityBtn).toHaveLength(0);
		});
	});

	describe('accessible labels in Spanish', () => {
		it('reorder buttons have Spanish aria-labels', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(
				screen.getByRole('button', { name: /Mover Frase hacia arriba/ }),
			).toBeInTheDocument();
			expect(
				screen.getByRole('button', { name: /Mover Frase hacia abajo/ }),
			).toBeInTheDocument();
		});

		it('visibility toggle buttons have Spanish aria-labels', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getByRole('button', { name: /Ocultar Frase/ })).toBeInTheDocument();
		});

		it('section status labels are in Spanish', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(screen.getAllByText('Visible').length).toBeGreaterThanOrEqual(1);
			expect(screen.getAllByText('Requerida').length).toBeGreaterThanOrEqual(1);
		});

		it('nav has Spanish aria-label', () => {
			render(<EditorSidebar {...createProps()} />);
			expect(
				screen.getByRole('navigation', { name: 'Secciones del editor' }),
			).toBeInTheDocument();
		});
	});
});
