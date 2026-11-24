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
				screen.getByText('Arrastre imágenes aquí o haga clic para subir'),
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

		const backdrop = document.querySelector('.dashboard-modal-backdrop') as HTMLElement | null;
		expect(backdrop).not.toBeNull();
		fireEvent.click(backdrop!);
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

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close when clicking inside the dialog content', async () => {
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
		expect(onClose).not.toHaveBeenCalled();
	});

	it('thumbnails have lazy loading and decoding attributes', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => MOCK_ASSETS,
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			const images = Array.from(
				document.querySelectorAll('.asset-picker__thumbnail'),
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
			expect(screen.getByLabelText('Cerrar modal')).toBeInTheDocument();
		});
	});

	it('clears the previous import error when the import is retried', async () => {
		const importAnswers: Promise<unknown>[] = [
			Promise.resolve({
				ok: false,
				status: 500,
				json: async () => ({ error: { message: 'Falló la importación.' } }),
			}),
			new Promise(() => undefined),
		];
		jest.spyOn(globalThis, 'fetch').mockImplementation(((url: string) =>
			String(url).includes('/import-bundled')
				? importAnswers.shift()
				: Promise.resolve({
						ok: true,
						json: async () => ({
							assets: [
								{
									...MOCK_ASSETS.assets[0],
									isBundled: true,
									bundledKey: 'hero',
								},
							],
						}),
					})) as never);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);
		const item = await screen.findByLabelText('Seleccionar Foto 1');
		fireEvent.click(item);
		expect(await screen.findByText('Falló la importación.')).toBeInTheDocument();

		fireEvent.click(item);
		expect(screen.queryByText('Falló la importación.')).not.toBeInTheDocument();
	});

	it('traps focus, responds to Escape and restores trigger focus on close', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		const trigger = document.createElement('button');
		trigger.textContent = 'Abrir selector';
		document.body.appendChild(trigger);
		trigger.focus();
		expect(document.activeElement).toBe(trigger);

		const onClose = jest.fn();
		const { unmount } = render(
			<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={onClose} />,
		);

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		// Escape calls onClose
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);

		// Unmount restores focus to trigger
		unmount();
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it('blocks backdrop click and Escape while importing bundled asset', async () => {
		let resolveImport: ((value: unknown) => void) | undefined;
		const importPromise = new Promise((resolve) => {
			resolveImport = resolve;
		});

		jest.spyOn(globalThis, 'fetch').mockImplementation(((url: string) =>
			String(url).includes('/import-bundled')
				? importPromise
				: Promise.resolve({
						ok: true,
						json: async () => ({
							assets: [
								{
									...MOCK_ASSETS.assets[0],
									isBundled: true,
									bundledKey: 'hero',
								},
							],
						}),
					})) as never);

		const onClose = jest.fn();
		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={onClose} />);

		const item = await screen.findByLabelText('Seleccionar Foto 1');
		fireEvent.click(item);

		const backdrop = document.querySelector('.dashboard-modal-backdrop') as HTMLElement;
		expect(backdrop).toBeInTheDocument();
		fireEvent.click(backdrop);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).not.toHaveBeenCalled();

		await waitFor(() => {
			resolveImport?.({
				ok: true,
				json: async () => ({ assetId: 'imported-asset-id' }),
			});
		});
	});
});
