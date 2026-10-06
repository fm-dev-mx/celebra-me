import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesSharedGallery from '@/components/memories/MemoriesSharedGallery';
import type { MemoriesGalleryItem } from '@/lib/memories/contract/catalog';

const TOKEN = 'a'.repeat(43);
const BASE = `/api/memories/ana-y-luis/gallery/${TOKEN}`;

const photo: MemoriesGalleryItem = {
	id: 'photo-1',
	mimeType: 'image/jpeg',
	durationSeconds: null,
	caption: 'Primer baile',
	createdAt: '2026-11-15T03:00:00.000Z',
	hasThumbnail: true,
	uploaderName: 'Tía Ana',
};

function respond(payload: unknown, status = 200): Response {
	return { ok: status < 300, status, json: async () => payload } as Response;
}

describe('MemoriesSharedGallery island', () => {
	beforeEach(() => (globalThis.fetch as jest.Mock).mockReset());

	it('lists thumbnails by day and opens a read-only viewer with a download link', async () => {
		const user = userEvent.setup();
		(globalThis.fetch as jest.Mock).mockResolvedValue(
			respond({ items: [photo, { ...photo, id: 'photo-2', caption: '' }], nextPage: null }),
		);

		render(<MemoriesSharedGallery publicSlug="ana-y-luis" token={TOKEN} timeZone="UTC" />);

		const tile = await screen.findByRole('button', { name: 'Foto de Tía Ana, Primer baile' });
		expect(globalThis.fetch).toHaveBeenCalledWith(`${BASE}/items?page=0`, expect.anything());
		expect(tile.querySelector('img')).toHaveAttribute(
			'src',
			`${BASE}/items/photo-1?variant=thumb`,
		);

		await user.click(tile);
		const viewer = screen.getByRole('dialog', { name: 'Recuerdo 1 de 2' });
		expect(within(viewer).getByRole('img', { name: 'Primer baile' })).toHaveAttribute(
			'src',
			`${BASE}/items/photo-1`,
		);
		expect(within(viewer).getByRole('link', { name: 'Descargar' })).toHaveAttribute(
			'href',
			`${BASE}/items/photo-1?download=1`,
		);
		await user.keyboard('{ArrowRight}');
		expect(screen.getByRole('dialog', { name: 'Recuerdo 2 de 2' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Eliminar|Ocultar/ })).not.toBeInTheDocument();
	});

	it('explains a failure and retries', async () => {
		const user = userEvent.setup();
		(globalThis.fetch as jest.Mock)
			.mockResolvedValueOnce(respond(null, 503))
			.mockResolvedValueOnce(respond({ items: [photo], nextPage: null }));

		render(<MemoriesSharedGallery publicSlug="ana-y-luis" token={TOKEN} timeZone="UTC" />);

		expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la galería');
		await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
		expect(await screen.findByRole('button', { name: /Foto de Tía Ana/ })).toBeInTheDocument();
	});
});
