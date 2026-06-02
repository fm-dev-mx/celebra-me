import { fireEvent, render, screen } from '@testing-library/react';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';
import FocalPointControl from '@/components/dashboard/intake/editor/FocalPointControl';

describe('GalleryEditor', () => {
	it('edits captions and reorders the complete gallery value', () => {
		const onChange = jest.fn();
		const value = {
			title: 'Galería',
			items: [
				{ image: 'gallery01', caption: 'Primera' },
				{ image: 'gallery02', caption: 'Segunda' },
			],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={onChange} />,
		);

		fireEvent.change(screen.getAllByLabelText('Pie de foto')[0], {
			target: { value: 'Nuevo pie' },
		});
		expect(onChange).toHaveBeenLastCalledWith({
			...value,
			items: [{ image: 'gallery01', caption: 'Nuevo pie' }, value.items[1]],
		});

		fireEvent.click(screen.getAllByText('Bajar')[0]);
		expect(onChange).toHaveBeenLastCalledWith({
			...value,
			items: [value.items[1], value.items[0]],
		});
	});

	it('renders items with internal asset references without crashing', () => {
		const value = {
			title: 'Test',
			items: [
				{ image: { type: 'internal' as const, key: 'hero' as const }, caption: 'Hero' },
				{
					image: { type: 'internal' as const, key: 'gallery01' as const },
					caption: 'Gallery',
				},
			],
		};

		expect(() =>
			render(
				<GalleryEditor
					value={value}
					previewSlug="demo-xv-jewelry-box"
					onChange={jest.fn()}
				/>,
			),
		).not.toThrow();

		expect(screen.getAllByText('Vista previa no disponible')).toHaveLength(4);
	});

	it('renders external image references with correct src', () => {
		const value = {
			title: 'Test',
			items: [
				{
					image: { type: 'external' as const, src: '/uploads/photo.jpg' },
					caption: 'Photo',
				},
				{
					image: { type: 'external' as const, src: 'https://example.com/img.jpg' },
					caption: 'Web',
				},
			],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={jest.fn()} />,
		);

		const srcs = screen.getAllByRole('img').map((img) => (img as HTMLImageElement).src);
		expect(srcs.filter((s) => s.includes('/uploads/photo.jpg'))).toHaveLength(3);
		expect(srcs.filter((s) => s === 'https://example.com/img.jpg')).toHaveLength(3);
	});

	it('shows placeholder text when image source cannot be resolved', () => {
		const value = {
			title: 'Test',
			items: [{ image: 'unknown-image-key-that-does-not-start-with-slash-or-https' }],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={jest.fn()} />,
		);

		expect(screen.getAllByText('Vista previa no disponible')).toHaveLength(2);
	});

	it('renders public layout roles with mobile and desktop crop frames', () => {
		render(
			<GalleryEditor
				value={{
					title: 'Test',
					items: [{ image: { type: 'external', src: '/uploads/photo.jpg' } }],
				}}
				previewSlug="demo-xv-luxury-hacienda"
				variant="luxury-hacienda"
				onChange={jest.fn()}
			/>,
		);

		const item = screen.getByText('Fotografía 1').closest('article');
		expect(item).toHaveAttribute('data-layout-role', 'feature');
		expect(screen.getByText('Destacada')).toBeInTheDocument();
		expect(screen.getAllByText('Móvil').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Escritorio').length).toBeGreaterThan(0);
		expect(screen.getByLabelText('Modo de recorte')).toHaveValue('mobile');
	});

	it('updates percentage focal point from direct pointer selection', () => {
		const onChange = jest.fn();
		render(<FocalPointControl value="" imageSrc="/uploads/photo.jpg" onChange={onChange} />);
		const preview = screen.getByLabelText('Seleccionar punto focal');
		const rectSpy = jest.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 200,
			height: 100,
			right: 200,
			bottom: 100,
			x: 0,
			y: 0,
			toJSON: () => undefined,
		});

		fireEvent.click(preview, { clientX: 50, clientY: 25 });
		expect(onChange).toHaveBeenCalledWith('25% 25%');
		rectSpy.mockRestore();
	});
});
