import { fireEvent, render, screen } from '@testing-library/react';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';

describe('ImageAssetField', () => {
	it('renders an empty image selector surface', () => {
		render(
			<ImageAssetField
				label="Imagen de portada"
				value={undefined}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(screen.getByText('Sin imagen')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Seleccionar imagen' })).toBeInTheDocument();
	});

	it('renders selected image state for an external image', () => {
		render(
			<ImageAssetField
				label="Imagen familiar"
				value={{ type: 'external', src: 'https://cdn.test/family.webp' }}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(screen.getByText('Imagen seleccionada')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Imagen familiar' })).toHaveAttribute(
			'src',
			'https://cdn.test/family.webp',
		);
		expect(screen.getByRole('button', { name: 'Cambiar imagen' })).toBeInTheDocument();
	});

	it('renders default state when defaultPreview is provided with empty value', () => {
		render(
			<ImageAssetField
				label="Imagen de portada"
				value={undefined}
				defaultPreview={{ src: 'https://cdn.test/default.webp', label: 'Default' }}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(screen.getByText('Imagen predeterminada')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Imagen de portada' })).toHaveAttribute(
			'src',
			'https://cdn.test/default.webp',
		);
	});

	it('applies --default class when isDefaultImage is true with a value', () => {
		const { container } = render(
			<ImageAssetField
				label="Imagen de agradecimiento"
				value={{ type: 'external', src: 'https://cdn.test/thankyou.webp' }}
				isDefaultImage
				defaultPreview={{ src: 'https://cdn.test/thankyou.webp' }}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(screen.getByText('Imagen predeterminada')).toBeInTheDocument();
		expect(
			container.querySelector('.invitation-editor__image-card--default'),
		).toBeInTheDocument();
	});

	it('renders missing state when preview cannot resolve a source', () => {
		const value = {
			type: 'uploaded' as const,
			assetId: '00000000-0000-0000-0000-000000000001',
		};

		render(
			<ImageAssetField label="Imagen del lugar" value={value} onOpenLibrary={jest.fn()} />,
		);

		expect(screen.getByText('Imagen faltante')).toBeInTheDocument();
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
	});

	it('opens the existing asset library flow when the action is clicked', () => {
		const onOpenLibrary = jest.fn();
		render(
			<ImageAssetField
				label="Retrato"
				value={undefined}
				emptyActionLabel="Seleccionar retrato"
				onOpenLibrary={onOpenLibrary}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Seleccionar retrato' }));
		expect(onOpenLibrary).toHaveBeenCalledTimes(1);
	});

	it('renders description text when description prop is provided', () => {
		render(
			<ImageAssetField
				label="Fondo de portada"
				description="Texto de ayuda para el usuario."
				value={undefined}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(screen.getByText('Texto de ayuda para el usuario.')).toBeInTheDocument();
	});

	it('does not render description paragraph when description is omitted', () => {
		const { container } = render(
			<ImageAssetField
				label="Fondo de portada"
				value={undefined}
				onOpenLibrary={jest.fn()}
			/>,
		);

		expect(
			container.querySelector('.invitation-editor__image-field-desc'),
		).not.toBeInTheDocument();
	});
});
