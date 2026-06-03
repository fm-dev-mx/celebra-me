import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetLibraryPanel from '@/components/dashboard/intake/editor/AssetLibraryPanel';

const MOCK_ASSETS = {
	assets: [
		{
			id: 'asset-1',
			displayName: 'Foto A',
			src: 'https://cdn.test/a.webp',
			usage: { usedInDraft: true, usedInPublished: false },
		},
		{
			id: 'asset-2',
			displayName: 'Foto B',
			src: 'https://cdn.test/b.webp',
			usage: { usedInDraft: false, usedInPublished: false },
		},
	],
};

beforeEach(() => {
	jest.restoreAllMocks();
});

describe('AssetLibraryPanel', () => {
	it('renders loading state initially', () => {
		jest.spyOn(globalThis, 'fetch').mockImplementation(
			() => new Promise(() => undefined) as never,
		);

		render(<AssetLibraryPanel invitationId="test-id" />);

		expect(screen.getByText(/Cargando biblioteca/i)).toBeInTheDocument();
	});

	it('renders empty state with Spanish copy', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Aún no hay imágenes en esta biblioteca.')).toBeInTheDocument();
		});
		expect(
			screen.getByText('Sube una imagen para usarla en la invitación.'),
		).toBeInTheDocument();
	});

	it('renders assets with usage info', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto A')).toBeInTheDocument();
			expect(screen.getByText('Foto B')).toBeInTheDocument();
		});
		expect(screen.getByText('Borrador')).toBeInTheDocument();
		expect(screen.getByText('No utilizado')).toBeInTheDocument();
	});

	it('disables delete button for assets in use', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto A')).toBeInTheDocument();
		});

		const inUseButton = screen.getByRole('button', { name: /Foto A/i });
		expect(inUseButton).toBeDisabled();
	});

	it('renders conflict message in Spanish when delete is blocked', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);
		fetchSpy.mockResolvedValueOnce({
			ok: false,
			status: 409,
			json: async () => ({
				error: {
					code: 'conflict',
					message: 'No se puede eliminar: la imagen está siendo utilizada.',
					details: {
						sectionRefs: ['gallery.items[0].image', 'hero.backgroundImage'],
						usedInDraft: true,
						usedInPublished: false,
					},
				},
			}),
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto B')).toBeInTheDocument();
		});

		const deleteButton = screen.getByRole('button', { name: /Foto B/i });
		fireEvent.click(deleteButton);

		await waitFor(() => {
			expect(
				screen.getByText(/No se puede eliminar esta imagen porque está siendo utilizada/),
			).toBeInTheDocument();
		});
		expect(
			screen.getByText(
				/Usos detectados: gallery\.items\[0\]\.image, hero\.backgroundImage\./,
			),
		).toBeInTheDocument();
	});

	it('uses archive language for successful delete', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true }),
		} as Response);
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto B')).toBeInTheDocument();
		});

		const deleteButton = screen.getByRole('button', { name: /Foto B/i });
		fireEvent.click(deleteButton);

		await waitFor(() => {
			expect(screen.getByText('Imagen archivada correctamente.')).toBeInTheDocument();
		});
	});

	it('disables delete button while delete is pending', async () => {
		let resolveDelete: (value: Response) => void = () => undefined;
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		fetchSpy.mockResolvedValueOnce({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);
		fetchSpy.mockImplementationOnce(
			() =>
				new Promise<Response>((resolve) => {
					resolveDelete = resolve;
				}) as never,
		);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto B')).toBeInTheDocument();
		});

		const deleteButton = screen.getByRole('button', { name: /Foto B/i });
		fireEvent.click(deleteButton);

		await waitFor(() => {
			expect(deleteButton).toBeDisabled();
			expect(screen.getByText('Archivando...')).toBeInTheDocument();
		});

		resolveDelete({ ok: true, json: async () => ({ success: true }) } as Response);
		await waitFor(() => {
			expect(screen.queryByText('Archivando...')).not.toBeInTheDocument();
		});
	});

	it('shows a fetch error message in Spanish', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: false,
			json: async () => ({ error: { message: 'Fallo al cargar la biblioteca.' } }),
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Fallo al cargar la biblioteca.')).toBeInTheDocument();
		});
	});
});
