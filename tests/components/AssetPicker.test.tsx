import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetPicker from '@/components/dashboard/intake/editor/AssetPicker';

const MOCK_ASSETS = {
	assets: [
		{
			id: 'asset-1',
			displayName: 'Foto 1',
			src: 'https://cdn.test/foto1.webp',
			usage: { usedInDraft: true, usedInPublished: false },
		},
		{
			id: 'asset-2',
			displayName: 'Foto 2',
			src: 'https://cdn.test/foto2.webp',
			usage: { usedInDraft: false, usedInPublished: true },
		},
		{
			id: 'asset-3',
			displayName: 'Foto 3',
			src: 'https://cdn.test/foto3.webp',
			usage: { usedInDraft: false, usedInPublished: false },
		},
	],
};

beforeEach(() => {
	jest.restoreAllMocks();
});

describe('AssetPicker', () => {
	it('renders loading state', () => {
		jest.spyOn(globalThis, 'fetch').mockImplementation(
			() => new Promise(() => undefined) as never,
		);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		expect(screen.getByText(/Cargando biblioteca/i)).toBeInTheDocument();
	});

	it('handles fetch error', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: false,
			json: async () => ({ error: { message: 'Fallo al cargar la biblioteca.' } }),
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Fallo al cargar la biblioteca.')).toBeInTheDocument();
		});
	});

	it('fetches and displays assets', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Foto 1')).toBeInTheDocument();
			expect(screen.getByText('Foto 2')).toBeInTheDocument();
			expect(screen.getByText('Foto 3')).toBeInTheDocument();
		});
	});

	it('shows usage badges', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Borrador')).toBeInTheDocument();
			expect(screen.getByText('Publicación')).toBeInTheDocument();
			expect(screen.getByText('No utilizado')).toBeInTheDocument();
		});
	});

	it('returns the selected assetId on selection', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		const onSelect = jest.fn();
		render(<AssetPicker invitationId="test-id" onSelect={onSelect} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Foto 1')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText('Foto 1'));
		expect(onSelect).toHaveBeenCalledWith('asset-1');
	});

	it('renders empty state with Spanish copy', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Aún no hay imágenes en esta biblioteca.')).toBeInTheDocument();
			expect(
				screen.getByText('Sube una imagen para usarla en la invitación.'),
			).toBeInTheDocument();
		});
	});

	it('shows upload area', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(
				screen.getByText('Arrastra imágenes aquí o haz clic para subir'),
			).toBeInTheDocument();
		});
	});

	it('closes on overlay click', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		const onClose = jest.fn();
		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('dialog'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('closes on Escape key', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		const onClose = jest.fn();
		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close when clicking inside the dialog content', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		const onClose = jest.fn();
		const { container } = render(
			<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={onClose} />,
		);

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		const inner = container.querySelector('.asset-picker') as HTMLElement | null;
		expect(inner).not.toBeNull();
		fireEvent.click(inner!);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('thumbnails have lazy loading and decoding attributes', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		const { container } = render(
			<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />,
		);

		await waitFor(() => {
			const images = Array.from(
				container.querySelectorAll('.asset-picker__thumbnail'),
			) as HTMLImageElement[];
			expect(images.length).toBeGreaterThan(0);
			images.forEach((img) => {
				expect(img.getAttribute('loading')).toBe('lazy');
				expect(img.getAttribute('decoding')).toBe('async');
			});
		});
	});

	it('item buttons have descriptive aria-labels', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByLabelText('Seleccionar Foto 1')).toBeInTheDocument();
			expect(screen.getByLabelText('Cerrar selector de imágenes')).toBeInTheDocument();
		});
	});
});
