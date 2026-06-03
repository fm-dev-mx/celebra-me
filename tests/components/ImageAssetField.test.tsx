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

		expect(screen.getByText('Sin imagen seleccionada')).toBeInTheDocument();
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

	it('renders uploaded draft reference with library meta and no src-based image', () => {
		const value = {
			type: 'uploaded' as const,
			assetId: '00000000-0000-0000-0000-000000000001',
		};

		render(
			<ImageAssetField label="Imagen del lugar" value={value} onOpenLibrary={jest.fn()} />,
		);

		expect(screen.getByText('Imagen seleccionada')).toBeInTheDocument();
		expect(screen.getByText('Biblioteca')).toBeInTheDocument();
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
	});
});
