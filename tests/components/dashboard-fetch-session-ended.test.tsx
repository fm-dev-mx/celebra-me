import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetLibraryPanel from '@/components/dashboard/intake/editor/AssetLibraryPanel';
import AssetPicker from '@/components/dashboard/intake/editor/AssetPicker';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { goToLoginAfterSessionEnded } from '@/lib/dashboard/session-ended';
import { guestsApi } from '@/lib/dashboard/guests-api';

jest.mock('@/lib/dashboard/session-ended', () => ({ goToLoginAfterSessionEnded: jest.fn() }));

const ASSETS = [
	{
		id: 'asset-1',
		displayName: 'Foto 1',
		defaultAltText: '',
		src: 'https://cdn.test/foto1.webp',
		usage: {
			usedInDraft: false,
			usedInPublished: false,
			draftSectionRefs: [],
			publishedSectionRefs: [],
		},
	},
	{
		id: 'bundled-1',
		displayName: 'Incluida',
		src: 'https://cdn.test/incluida.webp',
		isBundled: true,
		bundledKey: 'hero',
		usage: {
			usedInDraft: false,
			usedInPublished: false,
			draftSectionRefs: [],
			publishedSectionRefs: [],
		},
	},
];

const unauthorized = { ok: false, status: 401, json: async () => ({}) } as Response;
const listing = { ok: true, status: 200, json: async () => ({ assets: ASSETS }) } as Response;

/** Serves the asset listing, and answers every other call with a 401. */
function mockListingThenUnauthorized() {
	return jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
		const method = (init as RequestInit | undefined)?.method ?? 'GET';
		return method === 'GET' ? listing : unauthorized;
	});
}

beforeEach(() => {
	jest.restoreAllMocks();
	(goToLoginAfterSessionEnded as jest.Mock).mockClear();
});

describe('panel fetch calls send the person to login on 401', () => {
	it('guestsApi.exportCsv', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized);

		await expect(guestsApi.exportCsv('event-1')).rejects.toThrow('Error al exportar CSV');

		expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1);
	});

	it('AssetUploader upload', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized);
		const { container } = render(<AssetUploader invitationId="inv-1" />);
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['x'], 'photo.webp', { type: 'image/webp' });
		Object.defineProperty(input, 'files', { value: [file] });
		fireEvent.change(input);

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
	});

	it('AssetPicker import-bundled', async () => {
		mockListingThenUnauthorized();
		render(<AssetPicker invitationId="inv-1" onSelect={jest.fn()} onClose={jest.fn()} />);

		fireEvent.click(await screen.findByLabelText('Seleccionar Incluida'));

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
	});

	it('AssetLibraryPanel rename (PATCH)', async () => {
		mockListingThenUnauthorized();
		render(<AssetLibraryPanel invitationId="inv-1" />);

		fireEvent.click(await screen.findByLabelText('Editar nombre: Foto 1'));
		fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Nuevo' } });
		fireEvent.click(screen.getByText('Guardar'));

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
	});

	it('AssetLibraryPanel delete', async () => {
		mockListingThenUnauthorized();
		render(<AssetLibraryPanel invitationId="inv-1" />);
		await screen.findByText('Foto 1');

		const enabled = screen
			.getAllByText('Eliminar')
			.find((button) => !button.hasAttribute('disabled'));
		fireEvent.click(enabled!);

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
	});

	it('AssetLibraryPanel restore (archived filter)', async () => {
		mockListingThenUnauthorized();
		render(<AssetLibraryPanel invitationId="inv-1" />);
		await screen.findByText('Foto 1');

		fireEvent.click(screen.getAllByRole('tab')[1]);
		fireEvent.click(await screen.findByLabelText('Restaurar Foto 1'));

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
	});

	it('useAssetLibrary listing', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized);
		render(<AssetLibraryPanel invitationId="inv-1" />);

		await waitFor(() => expect(goToLoginAfterSessionEnded).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
