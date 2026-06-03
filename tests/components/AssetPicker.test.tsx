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
			expect(screen.getByText('Usado en borrador')).toBeInTheDocument();
			expect(screen.getByText('Usado en publicación')).toBeInTheDocument();
			expect(screen.getByText('No utilizado')).toBeInTheDocument();
		});
	});

	it('returns { type: uploaded, assetId } on selection', async () => {
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

	it('renders empty state correctly', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ assets: [] }),
		} as Response);

		render(<AssetPicker invitationId="test-id" onSelect={jest.fn()} onClose={jest.fn()} />);

		await waitFor(() => {
			expect(screen.getByText('Aún no hay imágenes subidas.')).toBeInTheDocument();
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

		// Click the overlay (parent of the modal)
		fireEvent.click(screen.getByRole('dialog'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
