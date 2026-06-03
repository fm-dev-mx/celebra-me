import { fireEvent, render, screen, within } from '@testing-library/react';
import EditorSidebar from '@/components/dashboard/intake/editor/EditorSidebar';

const publicOrder = [
	'quote',
	'family',
	'gallery',
	'countdown',
	'location',
	'itinerary',
	'rsvp',
	'gifts',
	'thankYou',
];

function createProps(overrides?: Partial<Parameters<typeof EditorSidebar>[0]>) {
	return {
		activeSection: 'hero',
		savingSection: null,
		dirty: new Set<string>(),
		errors: {},
		sectionSource: () => undefined,
		sectionOrder: publicOrder,
		onSectionOrderChange: jest.fn(),
		getSectionHasContent: () => true,
		onSelectSection: jest.fn(),
		...overrides,
	};
}

function getGroup(groupLabel: string): HTMLElement {
	const heading = screen.getByText(groupLabel);
	const group = heading.closest('.invitation-editor__nav-group');
	expect(group).not.toBeNull();
	return group as HTMLElement;
}

describe('EditorSidebar', () => {
	it('renders public and configuration groups', () => {
		render(<EditorSidebar {...createProps()} />);

		expect(screen.getByText('Secciones públicas')).toBeInTheDocument();
		expect(screen.getByText('Configuración')).toBeInTheDocument();
	});

	it('renders public sections in public invitation order with Spanish labels', () => {
		render(<EditorSidebar {...createProps()} />);

		const publicGroup = getGroup('Secciones públicas');
		const labels = within(publicGroup)
			.getAllByRole('button')
			.filter((button) => button.className.includes('nav-public-link'))
			.map((button) => button.textContent);

		expect(labels).toEqual([
			'Portada',
			'Frase',
			'Familia',
			'Galería',
			'Cuenta regresiva',
			'Fecha y ubicaciones',
			'Programa',
			'Confirmación de asistencia',
			'Mesa de regalos',
			'Agradecimiento',
		]);
	});

	it('places configuration items outside the public section group', () => {
		render(<EditorSidebar {...createProps()} />);

		const publicGroup = getGroup('Secciones públicas');
		const configGroup = getGroup('Configuración');

		expect(publicGroup).not.toHaveTextContent('Datos de la invitación');
		expect(publicGroup).not.toHaveTextContent('Publicación');
		expect(publicGroup).not.toHaveTextContent('Biblioteca de imágenes');
		expect(publicGroup).not.toHaveTextContent('Música');
		expect(configGroup).toHaveTextContent('Datos de la invitación');
		expect(configGroup).toHaveTextContent('Publicación');
		expect(configGroup).toHaveTextContent('Biblioteca de imágenes');
		expect(configGroup).toHaveTextContent('Música');
	});

	it('shows personalized access as configuration only when it is in sectionOrder', () => {
		render(
			<EditorSidebar
				{...createProps({ sectionOrder: [...publicOrder, 'personalizedAccess'] })}
			/>,
		);

		expect(getGroup('Configuración')).toHaveTextContent('Acceso personalizado');
		expect(getGroup('Secciones públicas')).not.toHaveTextContent('Acceso personalizado');
	});

	it('does not expose raw internal public section keys as labels', () => {
		render(<EditorSidebar {...createProps()} />);

		const publicGroup = getGroup('Secciones públicas');
		for (const rawKey of ['hero', 'quote', 'location', 'rsvp', 'gifts', 'thankYou']) {
			expect(
				within(publicGroup).queryByText(rawKey, { exact: true }),
			).not.toBeInTheDocument();
		}
	});

	it('calls onSelectSection with the registry section id', () => {
		const onSelectSection = jest.fn();
		render(<EditorSidebar {...createProps({ onSelectSection })} />);

		fireEvent.click(screen.getByRole('button', { name: 'Frase' }));
		fireEvent.click(screen.getByRole('button', { name: 'Música' }));

		expect(onSelectSection).toHaveBeenNthCalledWith(1, 'quote');
		expect(onSelectSection).toHaveBeenNthCalledWith(2, 'music');
	});

	it('marks the selected section active', () => {
		render(<EditorSidebar {...createProps({ activeSection: 'gallery' })} />);

		const galleryRow = screen
			.getByRole('button', { name: 'Galería' })
			.closest('.invitation-editor__nav-item');
		expect(galleryRow).toHaveClass('invitation-editor__nav-item--active');
	});

	it('keeps hero required and not orderable', () => {
		render(<EditorSidebar {...createProps()} />);

		const heroRow = screen
			.getByRole('button', { name: 'Portada' })
			.closest('.invitation-editor__nav-item') as HTMLElement;
		expect(heroRow).toHaveTextContent('Requerida');
		expect(
			within(heroRow).queryByRole('button', { name: /Mover Portada/ }),
		).not.toBeInTheDocument();
	});

	it('reorders public sections using persisted sectionOrder', () => {
		const onSectionOrderChange = jest.fn();
		render(
			<EditorSidebar
				{...createProps({
					sectionOrder: ['quote', 'family', 'gallery'],
					onSectionOrderChange,
				})}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Mover Familia hacia arriba' }));

		expect(onSectionOrderChange).toHaveBeenCalledWith(['family', 'quote', 'gallery']);
	});

	it('toggles optional public sections', () => {
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

	it('shows Spanish status labels', () => {
		render(<EditorSidebar {...createProps({ getSectionHasContent: () => false })} />);

		expect(screen.getAllByText('Requerida').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Vacía').length).toBeGreaterThan(0);
	});
});
