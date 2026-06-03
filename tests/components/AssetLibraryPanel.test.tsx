import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetLibraryPanel from '@/components/dashboard/intake/editor/AssetLibraryPanel';

const MOCK_ASSETS = [
	{
		id: 'asset-1',
		displayName: 'Foto 1',
		defaultAltText: 'Alt text 1',
		src: 'https://cdn.test/foto1.webp',
		isDemo: false,
		mimeType: 'image/webp',
		usage: {
			usedInDraft: true,
			usedInPublished: false,
			draftSectionRefs: ['hero.backgroundImage'],
			publishedSectionRefs: [],
		},
	},
	{
		id: 'demo:test-slug:hero',
		displayName: 'Portada',
		src: 'https://cdn.test/hero.webp',
		isDemo: true,
		demoKey: 'hero',
		mimeType: 'image/webp',
		usage: {
			usedInDraft: true,
			usedInPublished: true,
			draftSectionRefs: [],
			publishedSectionRefs: ['hero.backgroundImage'],
		},
	},
	{
		id: 'asset-2',
		displayName: 'Foto 2',
		defaultAltText: '',
		src: 'https://cdn.test/foto2.webp',
		isDemo: false,
		mimeType: 'image/webp',
		usage: {
			usedInDraft: false,
			usedInPublished: false,
			draftSectionRefs: [],
			publishedSectionRefs: [],
		},
	},
];

beforeEach(() => {
	jest.restoreAllMocks();
	jest.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		json: async () => ({ assets: MOCK_ASSETS }),
	} as Response);
});

describe('AssetLibraryPanel', () => {
	it('renders loading state initially', async () => {
		let resolvePromise!: (value: Response) => void;
		jest.spyOn(globalThis, 'fetch').mockReturnValue(
			new Promise<Response>((resolve) => {
				resolvePromise = resolve;
			}),
		);
		render(<AssetLibraryPanel invitationId="test-id" />);
		expect(screen.getByText(/Cargando biblioteca/i)).toBeInTheDocument();
		resolvePromise({ ok: true, json: async () => ({ assets: MOCK_ASSETS }) } as Response);
		await screen.findByText('Foto 1');
	});

	it('renders uploaded and demo assets', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto 1')).toBeInTheDocument();
			expect(screen.getByText('Foto 2')).toBeInTheDocument();
			expect(screen.getByText('Portada')).toBeInTheDocument();
		});
	});

	it('shows demo badge on demo assets', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getAllByText('Imagen de demo').length).toBeGreaterThan(0);
		});
	});

	it('shows usage badges', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Borrador')).toBeInTheDocument();
			expect(screen.getByText('No utilizado')).toBeInTheDocument();
		});
	});

	it('shows section refs for used assets', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getAllByText('Usos de esta imagen').length).toBeGreaterThan(0);
		});

		const summaries = screen.getAllByText('Usos de esta imagen');
		fireEvent.click(summaries[0]);

		await waitFor(() => {
			expect(screen.getAllByText('hero.backgroundImage').length).toBeGreaterThan(0);
		});
	});

	it('delete button is disabled for used assets', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			const deleteButtons = screen.getAllByText('Eliminar');
			expect(deleteButtons[0]).toBeDisabled();
		});
	});

	it('delete button is enabled for unused assets', async () => {
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			const deleteButtons = screen.getAllByText('Eliminar');
			const enabledButtons = deleteButtons.filter((btn) => !btn.hasAttribute('disabled'));
			expect(enabledButtons.length).toBeGreaterThan(0);
		});
	});

	it('shows empty state when no assets', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Aún no hay imágenes en esta biblioteca.')).toBeInTheDocument();
		});
	});

	it('sends PATCH request on rename', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto 1')).toBeInTheDocument();
		});

		const editButton = screen.getByLabelText('Editar nombre: Foto 1');
		fireEvent.click(editButton);

		const input = screen.getByLabelText('Nombre visible');
		fireEvent.change(input, { target: { value: 'Foto renombrada' } });

		const saveButton = screen.getByText('Guardar');
		fireEvent.click(saveButton);

		await waitFor(() => {
			const patchCalls = fetchSpy.mock.calls.filter(
				([, init]) => (init as RequestInit)?.method === 'PATCH',
			);
			expect(patchCalls.length).toBeGreaterThan(0);
			const patchBody = JSON.parse((patchCalls[0][1] as RequestInit).body as string);
			expect(patchBody).toMatchObject({ displayName: 'Foto renombrada' });
		});
	});

	it('sends DELETE request on delete click', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch');
		render(<AssetLibraryPanel invitationId="test-id" />);

		await waitFor(() => {
			expect(screen.getByText('Foto 2')).toBeInTheDocument();
		});

		const deleteButtons = screen.getAllByText('Eliminar');
		const enabledDelete = deleteButtons.find((btn) => !btn.hasAttribute('disabled'));
		expect(enabledDelete).toBeTruthy();
		if (enabledDelete) fireEvent.click(enabledDelete);

		await waitFor(() => {
			const deleteCalls = fetchSpy.mock.calls.filter(
				([, init]) => (init as RequestInit)?.method === 'DELETE',
			);
			expect(deleteCalls.length).toBeGreaterThan(0);
		});
	});
});
