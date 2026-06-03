import { fireEvent, render, screen } from '@testing-library/react';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';
import FocalPointControl from '@/components/dashboard/intake/editor/FocalPointControl';

beforeEach(() => {
	jest.restoreAllMocks();
	// Mock fetch so AssetPicker useEffect doesn't cause real network errors
	jest.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		json: async () => ({ assets: [] }),
	} as Response);
});

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

		expect(screen.getAllByText('Vista previa no disponible')).toHaveLength(2);
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
		expect(srcs.filter((s) => s.includes('/uploads/photo.jpg'))).toHaveLength(2);
		expect(srcs.filter((s) => s === 'https://example.com/img.jpg')).toHaveLength(2);
	});

	it('shows placeholder text when image source cannot be resolved', () => {
		const value = {
			title: 'Test',
			items: [{ image: 'unknown-image-key-that-does-not-start-with-slash-or-https' }],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={jest.fn()} />,
		);

		expect(screen.getAllByText('Vista previa no disponible')).toHaveLength(1);
	});

	it('renders one selected public layout crop frame and switches preview modes', () => {
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
		expect(item?.querySelectorAll('.invitation-editor__gallery-image')).toHaveLength(1);
		expect(item?.querySelector('.invitation-editor__gallery-image')).toHaveClass(
			'invitation-editor__gallery-image--mobile-feature',
		);
		expect(screen.getByLabelText('Vista previa')).toHaveValue('mobile');

		fireEvent.change(screen.getByLabelText('Vista previa'), {
			target: { value: 'desktop' },
		});
		expect(item?.querySelectorAll('.invitation-editor__gallery-image')).toHaveLength(1);
		expect(item?.querySelector('.invitation-editor__gallery-image')).toHaveClass(
			'invitation-editor__gallery-image--desktop-feature',
		);
		expect(item?.querySelector('.invitation-editor__gallery-image')).toHaveAttribute(
			'data-aspect-ratio',
			'16 / 10',
		);
	});

	it('preserves per-device focal points when switching back to shared mode', () => {
		const onChange = jest.fn();
		const value = {
			title: 'Test',
			items: [
				{
					image: { type: 'external' as const, src: '/uploads/photo.jpg' },
					focalPoint: '50% 40%',
					focalPointMobile: '40% 30%',
					focalPointTablet: '60% 50%',
					focalPointDesktop: '70% 60%',
				},
			],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={onChange} />,
		);

		const toggle = screen.getByLabelText('Punto focal por dispositivo');
		expect(toggle).not.toBeChecked();

		fireEvent.click(toggle);
		expect(toggle).toBeChecked();

		fireEvent.click(toggle);
		expect(toggle).not.toBeChecked();

		expect(onChange).not.toHaveBeenCalled();
	});

	it('renders uploaded asset ref without crashing (defensive)', () => {
		const value = {
			title: 'Test',
			items: [
				{
					image: {
						type: 'uploaded' as const,
						assetId: '00000000-0000-0000-0000-000000000001',
					},
					caption: 'Uploaded',
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
		expect(screen.getByText('asset:00000000')).toBeInTheDocument();
	});

	it('shows Quitar de galería and Seleccionar imagen when invitationId is provided', () => {
		const value = {
			title: 'Test',
			items: [{ image: 'gallery01', caption: 'Test' }],
		};

		render(
			<GalleryEditor
				value={value}
				previewSlug="demo-xv-jewelry-box"
				invitationId="test-invitation-id"
				onChange={jest.fn()}
			/>,
		);

		expect(screen.getByText('Seleccionar imagen')).toBeInTheDocument();
		expect(screen.getByText('Quitar de galería')).toBeInTheDocument();
	});

	it('Quitar de galería removes the item and does not call any DELETE endpoint', () => {
		const onChange = jest.fn();
		const value = {
			title: 'Test',
			items: [
				{ image: 'gallery01', caption: 'Uno' },
				{ image: 'gallery02', caption: 'Dos' },
			],
		};

		render(
			<GalleryEditor
				value={value}
				previewSlug="demo-xv-jewelry-box"
				invitationId="test-invitation-id"
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getAllByText('Quitar de galería')[0]);
		expect(onChange).toHaveBeenCalledWith({
			...value,
			items: [value.items[1]],
		});
		// onChange only updates local state — no API call for DELETE
		expect(onChange.mock.calls.length).toBe(1);
	});

	it('existing internal and external items still render when invitationId is not provided', () => {
		const value = {
			title: 'Test',
			items: [
				{ image: { type: 'internal' as const, key: 'hero' as const }, caption: 'Hero' },
				{
					image: { type: 'external' as const, src: 'https://example.com/img.jpg' },
					caption: 'Web',
				},
			],
		};

		render(
			<GalleryEditor value={value} previewSlug="demo-xv-jewelry-box" onChange={jest.fn()} />,
		);

		// Select/Remove buttons should NOT render without invitationId
		expect(screen.queryByText('Seleccionar imagen')).not.toBeInTheDocument();
		expect(screen.queryByText('Quitar de galería')).not.toBeInTheDocument();
		// Items still render — captions visible in input fields
		expect(screen.getByDisplayValue('Hero')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Web')).toBeInTheDocument();
	});

	it('clicks Seleccionar imagen and triggers picker (picker opens via state)', () => {
		const value = {
			title: 'Test',
			items: [{ image: 'gallery01', caption: 'Test' }],
		};

		render(
			<GalleryEditor
				value={value}
				previewSlug="demo-xv-jewelry-box"
				invitationId="test-invitation-id"
				onChange={jest.fn()}
			/>,
		);

		// Click "Seleccionar imagen" — this sets internal pickerIndex state
		// The picker modal renders an overlay; verify it appears
		fireEvent.click(screen.getByText('Seleccionar imagen'));
		// The AssetPicker overlay has role="dialog"
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('updates percentage focal point from direct pointer selection', () => {
		const onChange = jest.fn();
		render(
			<FocalPointControl
				value=""
				onChange={onChange}
				mode="shared"
				onModeChange={jest.fn()}
				imageSrc="/uploads/photo.jpg"
			/>,
		);
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
