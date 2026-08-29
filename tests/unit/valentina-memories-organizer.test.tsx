import { webcrypto } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValentinaMemoriesOrganizer, {
	buildValentinaMemoriesOrganizerCatalogUrl,
} from '@/components/dashboard/memories/ValentinaMemoriesOrganizer';
import type { ValentinaMemoriesOrganizerItem } from '@/data/valentina-memories-media.contract';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const acceptedItem: ValentinaMemoriesOrganizerItem = {
	id: 'accepted-item',
	mimeType: 'image/jpeg',
	sizeBytes: 1024,
	durationSeconds: null,
	caption: 'Familia',
	status: 'accepted',
	createdAt: '2026-08-29T12:00:00.000Z',
	updatedAt: '2026-08-29T12:00:00.000Z',
	acceptedAt: '2026-08-29T12:00:00.000Z',
	rejectedAt: null,
	deletedAt: null,
	uploader: { displayName: 'Tía Ana', guestAlias: 't-a1' },
};

const rejectedItem: ValentinaMemoriesOrganizerItem = {
	...acceptedItem,
	id: 'rejected-item',
	caption: '',
	status: 'rejected',
	acceptedAt: null,
	rejectedAt: '2026-08-29T12:05:00.000Z',
	uploader: { displayName: 'Luis', guestAlias: 'l-2' },
};

function jsonResponse(payload: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: async () => payload,
	} as Response;
}

describe('ValentinaMemoriesOrganizer', () => {
	beforeEach(() => {
		jest.restoreAllMocks();
	});

	it('serializes server filters and explicit UTC bounds for the organizer local date', () => {
		const built = buildValentinaMemoriesOrganizerCatalogUrl(3, {
			status: 'accepted',
			uploader: '  Tía   Ana  ',
			createdOn: '2026-08-29',
		});
		const url = new URL(built, 'https://celebra.test');
		expect(url.searchParams.get('page')).toBe('3');
		expect(url.searchParams.get('status')).toBe('accepted');
		expect(url.searchParams.get('uploader')).toBe('Tía Ana');
		const from = url.searchParams.get('createdFrom');
		const to = url.searchParams.get('createdTo');
		expect(from).toMatch(/Z$/);
		expect(to).toMatch(/Z$/);
		expect(Date.parse(String(to))).toBeGreaterThan(Date.parse(String(from)));
	});

	it('selects only approved items and keeps all and selected export scopes distinct', async () => {
		const user = userEvent.setup();
		const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = new URL(String(input), 'https://celebra.test');
			if (url.searchParams.get('status') === 'accepted') {
				return jsonResponse({ items: [acceptedItem], nextPage: null });
			}
			return jsonResponse({ items: [acceptedItem, rejectedItem], nextPage: null });
		});

		render(<ValentinaMemoriesOrganizer />);
		const accepted = await screen.findByLabelText('Seleccionar recuerdo de Tía Ana');
		const rejected = screen.getByLabelText('Seleccionar recuerdo de Luis');
		expect(accepted).toBeEnabled();
		expect(rejected).toBeDisabled();

		await user.click(accepted);
		expect(screen.getByText('1', { selector: 'strong' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Descargar seleccionados' }));
		expect(
			await screen.findByText('Sólo los recuerdos aprobados que seleccionó.'),
		).toBeVisible();
		expect(screen.getByText(/1 archivos aprobados en 1 lote/)).toBeVisible();
		await user.click(screen.getByRole('button', { name: 'Cancelar' }));

		await user.click(screen.getByRole('button', { name: 'Descargar todos los aprobados' }));
		expect(
			await screen.findByText(
				'Todos los recuerdos aprobados, sin aplicar los filtros visibles.',
			),
		).toBeVisible();
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(([input]) => String(input).includes('status=accepted')),
			).toBe(true),
		);
	});

	it('blocks ZIP generation until the organizer confirms the local password was saved', async () => {
		const user = userEvent.setup();
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(
			jsonResponse({ items: [acceptedItem], nextPage: null }),
		);
		render(<ValentinaMemoriesOrganizer />);
		await user.click(await screen.findByLabelText('Seleccionar recuerdo de Tía Ana'));
		await user.click(screen.getByRole('button', { name: 'Descargar seleccionados' }));
		await user.click(
			await screen.findByRole('button', { name: 'Continuar y crear contraseña' }),
		);

		const generate = screen.getByRole('button', { name: 'Generar ZIP' });
		expect(generate).toBeDisabled();
		expect(screen.getByText(/No se guarda ni se envía al servidor/)).toBeVisible();
		await user.click(
			screen.getByLabelText('Confirmo que guardé la contraseña en un lugar seguro.'),
		);
		expect(generate).toBeEnabled();
	});
});
