import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesOrganizer from '@/components/dashboard/memories/MemoriesOrganizer';
import {
	MemoriesRequestError,
	memoriesOrganizerApi,
	type OrganizerSpaceItem,
} from '@/lib/memories/client/api';
import { createMemoriesZip } from '@/lib/memories/client/export';
import type {
	MemoriesOrganizerItem,
	MemoriesOrganizerListResponse,
	MemoriesSpaceSummary,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_ARCHIVE_MAX_BYTES } from '@/lib/memories/contract/limits';

jest.mock('@/lib/memories/client/api', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/api')>(
		'@/lib/memories/client/api',
	);
	return {
		...actual,
		memoriesOrganizerApi: {
			listItems: jest.fn(),
			itemMediaUrl: jest.fn(),
			updateItem: jest.fn(),
			deleteItem: jest.fn(),
			revokeUploader: jest.fn(),
			fetchItemBlob: jest.fn(),
			summary: jest.fn(),
			qrUrl: jest.fn(),
			uploaders: jest.fn(),
			share: jest.fn(),
		},
	};
});

jest.mock('@/lib/memories/client/export', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/export')>(
		'@/lib/memories/client/export',
	);
	return { ...actual, createMemoriesZip: jest.fn() };
});

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const EVENT_STORAGE_KEY = 'memories-dashboard-event-id';

const organizerApi = memoriesOrganizerApi as jest.Mocked<typeof memoriesOrganizerApi>;
const mockedCreateZip = createMemoriesZip as jest.MockedFunction<typeof createMemoriesZip>;

const SPACES: OrganizerSpaceItem[] = [
	{
		eventId: 'event-1',
		publicSlug: 'victoria-y-roberto',
		eventTitle: 'Boda de Victoria y Roberto',
		timeZone: 'America/Mazatlan',
		uploadStartsAt: '2026-10-30T18:00:00.000Z',
		uploadEndsAt: '2026-11-02T06:00:00.000Z',
		retentionEndsAt: '2027-01-30T06:00:00.000Z',
		windowState: 'open',
	},
	{
		eventId: 'event-2',
		publicSlug: 'xv-de-sofia',
		eventTitle: 'XV de Sofía',
		timeZone: 'America/Mexico_City',
		uploadStartsAt: '2026-11-14T18:00:00.000Z',
		uploadEndsAt: '2026-11-16T06:00:00.000Z',
		retentionEndsAt: '2027-02-14T06:00:00.000Z',
		windowState: 'before',
	},
];

function summaryOf(space: OrganizerSpaceItem): MemoriesSpaceSummary {
	const { eventId: _eventId, ...summary } = space;
	return summary;
}

const acceptedItem: MemoriesOrganizerItem = {
	id: 'accepted-item',
	mimeType: 'image/jpeg',
	sizeBytes: 1024,
	durationSeconds: null,
	caption: 'Familia',
	status: 'accepted',
	createdAt: '2026-10-31T02:00:00.000Z',
	updatedAt: '2026-10-31T02:00:00.000Z',
	acceptedAt: '2026-10-31T02:00:00.000Z',
	rejectedAt: null,
	deletedAt: null,
	hasThumbnail: false,
	hidden: false,
	uploader: { displayName: 'Tía Ana', guestAlias: 'invitado-a1b2c3d4' },
};

const validatingItem: MemoriesOrganizerItem = {
	...acceptedItem,
	id: 'validating-item',
	caption: '',
	status: 'validating',
	acceptedAt: null,
	uploader: { displayName: 'Luis', guestAlias: 'invitado-e5f6a7b8' },
};

const largeAcceptedItem: MemoriesOrganizerItem = {
	...acceptedItem,
	id: 'large-item',
	mimeType: 'video/mp4',
	sizeBytes: MEMORIES_ARCHIVE_MAX_BYTES,
	durationSeconds: 30,
	caption: 'Baile',
	uploader: { displayName: 'Marta', guestAlias: 'invitado-c9d0e1f2' },
};

type ListPayload = MemoriesOrganizerListResponse & { space: MemoriesSpaceSummary };

function listPayload(items: MemoriesOrganizerItem[], nextPage: number | null = null): ListPayload {
	return { items, nextPage, space: summaryOf(SPACES[0]) };
}

function resetOrganizerApi(): void {
	for (const method of Object.values(organizerApi)) method.mockReset();
	organizerApi.itemMediaUrl.mockImplementation((eventId, itemId, mode) => {
		const base = `/api/dashboard/memories/${eventId}/items/${encodeURIComponent(itemId)}`;
		return mode ? `${base}?mode=${mode}` : base;
	});
	organizerApi.qrUrl.mockImplementation((eventId) => `/api/dashboard/memories/${eventId}/qr`);
	organizerApi.uploaders.mockResolvedValue([
		{ displayName: 'Tía Ana', guestAlias: 'invitado-a1b2c3d4', files: 2 },
	]);
	organizerApi.summary.mockImplementation(async (eventId) => {
		const space = SPACES.find((entry) => entry.eventId === eventId) ?? SPACES[0];
		return {
			...summaryOf(space),
			publicUrl: `https://celebra-me.com/r/${space.publicSlug}`,
			photos: 12,
			videos: 3,
			guestsWithUploads: 7,
			expectedGuests: null,
			shareUrl: null,
			lastAcceptedAt: null,
			capacityRemainingPercent: 88,
		};
	});
}

function stubDownloads() {
	const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
	const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
	const createObjectURL = jest.fn(() => 'blob:memories-export');
	const revokeObjectURL = jest.fn();
	Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
	Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
	const anchorClick = jest
		.spyOn(HTMLAnchorElement.prototype, 'click')
		.mockImplementation(() => undefined);
	return {
		createObjectURL,
		revokeObjectURL,
		anchorClick,
		restore() {
			anchorClick.mockRestore();
			if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
			else delete (URL as { createObjectURL?: unknown }).createObjectURL;
			if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
			else delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
		},
	};
}

async function renderCatalog(items: MemoriesOrganizerItem[] = [acceptedItem]) {
	organizerApi.listItems.mockResolvedValue(listPayload(items));
	render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
	await screen.findAllByRole('button', { name: /Tía Ana/ });
}

describe('MemoriesOrganizer island', () => {
	beforeEach(() => {
		window.localStorage.clear();
		resetOrganizerApi();
		mockedCreateZip.mockReset();
	});

	it('loads the initial event catalog as a gallery of tiles named after their uploaders', async () => {
		await renderCatalog([acceptedItem, validatingItem]);

		expect(organizerApi.listItems).toHaveBeenCalledTimes(1);
		expect(organizerApi.listItems).toHaveBeenCalledWith(
			'event-1',
			0,
			{
				status: 'all',
				uploader: '',
				uploaderAlias: '',
				kind: '',
				visibility: '',
				createdFrom: undefined,
				createdTo: undefined,
			},
			expect.any(AbortSignal),
		);
		const tile = screen.getByRole('button', { name: /^Foto de Tía Ana, .*Familia$/ });
		expect(tile.querySelector('img')).toHaveAttribute(
			'src',
			'/api/dashboard/memories/event-1/items/accepted-item?mode=thumb',
		);
		expect(screen.getByRole('button', { name: /Foto de Luis, .*Procesando/ })).toBeEnabled();
		expect(screen.queryByText('invitado-a1b2c3d4')).not.toBeInTheDocument();
		expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe('event-1');
	});

	it('reloads the catalog for the other event and persists the selection', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockImplementation(async (eventId) =>
			eventId === 'event-2'
				? { items: [validatingItem], nextPage: null, space: summaryOf(SPACES[1]) }
				: listPayload([acceptedItem]),
		);

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByRole('button', { name: /Tía Ana/ });

		await user.selectOptions(screen.getByDisplayValue('Boda de Victoria y Roberto'), 'event-2');

		expect(await screen.findByRole('button', { name: /Luis/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Tía Ana/ })).not.toBeInTheDocument();
		expect(organizerApi.listItems).toHaveBeenLastCalledWith(
			'event-2',
			0,
			expect.objectContaining({ status: 'all', uploader: '' }),
			expect.any(AbortSignal),
		);
		expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe('event-2');
	});

	it('applies the upload day as UTC bounds in the event time zone as soon as it changes', async () => {
		await renderCatalog();

		fireEvent.change(screen.getByLabelText('Día de subida'), {
			target: { value: '2026-10-30' },
		});

		await waitFor(() => expect(organizerApi.listItems).toHaveBeenCalledTimes(2));
		expect(organizerApi.listItems).toHaveBeenLastCalledWith(
			'event-1',
			0,
			expect.objectContaining({
				createdFrom: '2026-10-30T07:00:00.000Z',
				createdTo: '2026-10-31T07:00:00.000Z',
			}),
			expect.any(AbortSignal),
		);
	});

	it('filters by kind and by an exact guest as soon as they change', async () => {
		const user = userEvent.setup();
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: 'Videos' }));
		await waitFor(() =>
			expect(organizerApi.listItems).toHaveBeenLastCalledWith(
				'event-1',
				0,
				expect.objectContaining({ kind: 'video' }),
				expect.any(AbortSignal),
			),
		);
		await screen.findByRole('option', { name: 'Tía Ana (2)' });
		await user.selectOptions(screen.getByLabelText('Invitado'), 'invitado-a1b2c3d4');

		await waitFor(() =>
			expect(organizerApi.listItems).toHaveBeenLastCalledWith(
				'event-1',
				0,
				expect.objectContaining({ kind: 'video', uploaderAlias: 'invitado-a1b2c3d4' }),
				expect.any(AbortSignal),
			),
		);
		expect(await screen.findByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
	});

	it('shows only hidden memories with the Ocultas chip', async () => {
		const user = userEvent.setup();
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: 'Ocultas' }));

		await waitFor(() =>
			expect(organizerApi.listItems).toHaveBeenLastCalledWith(
				'event-1',
				0,
				expect.objectContaining({ visibility: 'hidden' }),
				expect.any(AbortSignal),
			),
		);
	});

	it('hides a memory from the viewer and marks its tile', async () => {
		const user = userEvent.setup();
		organizerApi.updateItem.mockResolvedValue(acceptedItem);
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: /Familia$/ }));
		const viewer = await screen.findByRole('dialog', { name: 'Recuerdo 1 de 1' });
		await user.click(within(viewer).getByRole('button', { name: 'Ocultar' }));

		await waitFor(() =>
			expect(organizerApi.updateItem).toHaveBeenCalledWith('event-1', 'accepted-item', {
				hidden: true,
			}),
		);
		expect(
			await within(viewer).findByRole('button', { name: 'Mostrar en la galería' }),
		).toBeInTheDocument();
		await user.keyboard('{Escape}');
		expect(await screen.findByRole('button', { name: /Familia, Oculta$/ })).toBeInTheDocument();
	});

	it('leaves hidden memories out of «Descargar todo» unless the host includes them', async () => {
		const user = userEvent.setup();
		const hiddenItem = { ...acceptedItem, id: 'hidden-item', hidden: true };
		organizerApi.listItems.mockImplementation(async (_eventId, _page, filters) =>
			filters.status === 'accepted'
				? listPayload([acceptedItem, hiddenItem])
				: listPayload([acceptedItem]),
		);
		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByRole('button', { name: /Familia$/ });

		await user.click(screen.getByRole('button', { name: 'Descargar todo' }));
		const dialog = await screen.findByRole('dialog', { name: 'Descargar recuerdos' });
		expect(await within(dialog).findByText('1 archivos en 1 lote.')).toBeInTheDocument();

		await user.click(within(dialog).getByLabelText('Incluir el recuerdo oculto'));
		expect(within(dialog).getByText('2 archivos en 1 lote.')).toBeInTheDocument();
	});

	it('opens the viewer on a tile and moves between memories with the arrow keys', async () => {
		const user = userEvent.setup();
		const second = { ...acceptedItem, id: 'second-item', caption: 'Pastel' };
		await renderCatalog([acceptedItem, second]);

		await user.click(screen.getByRole('button', { name: /Familia$/ }));
		const viewer = await screen.findByRole('dialog', { name: 'Recuerdo 1 de 2' });
		expect(within(viewer).getByRole('link', { name: 'Descargar' })).toHaveAttribute(
			'href',
			'/api/dashboard/memories/event-1/items/accepted-item',
		);

		await user.keyboard('{ArrowRight}');
		expect(await screen.findByRole('dialog', { name: 'Recuerdo 2 de 2' })).toBeInTheDocument();
		expect(screen.getByText('Pastel')).toBeInTheDocument();
	});

	it('saves a caption from the viewer without reloading the catalog', async () => {
		const user = userEvent.setup();
		organizerApi.updateItem.mockResolvedValue({ ...acceptedItem, caption: 'Abuelos' });
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: /Familia$/ }));
		const viewer = await screen.findByRole('dialog', { name: 'Recuerdo 1 de 1' });
		await user.click(within(viewer).getByRole('button', { name: 'Editar descripción' }));
		const field = within(viewer).getByLabelText('Descripción');
		await user.clear(field);
		await user.type(field, 'Abuelos');
		await user.click(within(viewer).getByRole('button', { name: 'Guardar' }));

		await waitFor(() =>
			expect(organizerApi.updateItem).toHaveBeenCalledWith('event-1', 'accepted-item', {
				caption: 'Abuelos',
			}),
		);
		expect(await within(viewer).findByText('Abuelos')).toBeInTheDocument();
		expect(organizerApi.listItems).toHaveBeenCalledTimes(1);
	});

	it('deletes a memory from the viewer after confirmation', async () => {
		const user = userEvent.setup();
		organizerApi.deleteItem.mockResolvedValue(undefined);
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: /Familia$/ }));
		const viewer = await screen.findByRole('dialog', { name: 'Recuerdo 1 de 1' });
		await user.click(within(viewer).getByRole('button', { name: 'Eliminar' }));
		const dialog = await screen.findByRole('dialog', { name: 'Eliminar recuerdo' });
		await user.click(within(dialog).getByRole('button', { name: 'Eliminar recuerdo' }));

		await waitFor(() =>
			expect(organizerApi.deleteItem).toHaveBeenCalledWith('event-1', 'accepted-item'),
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(organizerApi.listItems).toHaveBeenCalledTimes(2);
	});

	it('blocks the uploader by guest alias from the viewer', async () => {
		const user = userEvent.setup();
		organizerApi.revokeUploader.mockResolvedValue(undefined);
		await renderCatalog();

		await user.click(screen.getByRole('button', { name: /Familia$/ }));
		const viewer = await screen.findByRole('dialog', { name: 'Recuerdo 1 de 1' });
		await user.click(within(viewer).getByRole('button', { name: 'Bloquear invitado' }));
		const dialog = await screen.findByRole('dialog', { name: 'Bloquear a este invitado' });
		expect(
			within(dialog).getByText(/Tía Ana ya no podrá subir más archivos/),
		).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: 'Bloquear invitado' }));

		await waitFor(() =>
			expect(organizerApi.revokeUploader).toHaveBeenCalledWith(
				'event-1',
				'invitado-a1b2c3d4',
			),
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(organizerApi.updateItem).not.toHaveBeenCalled();
		expect(organizerApi.deleteItem).not.toHaveBeenCalled();
	});

	it('selects available memories only and deletes the selection one item at a time', async () => {
		const user = userEvent.setup();
		const second = { ...acceptedItem, id: 'second-item', caption: 'Pastel' };
		organizerApi.deleteItem.mockResolvedValue(undefined);
		await renderCatalog([acceptedItem, second, validatingItem]);

		await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
		expect(screen.getByRole('button', { name: /Luis/ })).toBeDisabled();
		const first = screen.getByRole('button', { name: /Familia$/ });
		await user.click(first);
		await user.click(screen.getByRole('button', { name: /Pastel$/ }));
		expect(first).toHaveAttribute('aria-pressed', 'true');

		const bar = screen.getByRole('region', { name: 'Acciones para la selección' });
		expect(within(bar).getByText('2')).toBeInTheDocument();
		await user.click(within(bar).getByRole('button', { name: 'Eliminar' }));
		const dialog = await screen.findByRole('dialog', { name: 'Eliminar 2 recuerdos' });
		await user.click(within(dialog).getByRole('button', { name: 'Eliminar 2 recuerdos' }));

		await waitFor(() => expect(organizerApi.deleteItem).toHaveBeenCalledTimes(2));
		expect(organizerApi.deleteItem).toHaveBeenCalledWith('event-1', 'accepted-item');
		expect(organizerApi.deleteItem).toHaveBeenCalledWith('event-1', 'second-item');
		await waitFor(() =>
			expect(
				screen.queryByRole('region', { name: 'Acciones para la selección' }),
			).not.toBeInTheDocument(),
		);
	});

	it('shows the authorization error when the catalog request is forbidden', async () => {
		organizerApi.listItems.mockRejectedValue(new MemoriesRequestError(403, 'forbidden'));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		expect(
			await screen.findByText('No tiene autorización para este evento.'),
		).toBeInTheDocument();
	});

	it('exports every available page into encrypted ZIP batches named after the public slug', async () => {
		const user = userEvent.setup();
		const downloads = stubDownloads();
		organizerApi.listItems.mockImplementation(async (_eventId, page, filters) => {
			if (filters.status === 'accepted') {
				return page === 0
					? listPayload([acceptedItem], 1)
					: listPayload([largeAcceptedItem], null);
			}
			return listPayload([acceptedItem, validatingItem, largeAcceptedItem]);
		});
		mockedCreateZip.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }));

		try {
			render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
			await screen.findByRole('button', { name: /Familia$/ });

			await user.click(screen.getByRole('button', { name: 'Descargar todo' }));

			const dialog = await screen.findByRole('dialog', { name: 'Descargar recuerdos' });
			expect(await within(dialog).findByText('2 archivos en 2 lotes.')).toBeInTheDocument();
			expect(organizerApi.listItems).toHaveBeenCalledWith('event-1', 0, {
				status: 'accepted',
			});
			expect(organizerApi.listItems).toHaveBeenCalledWith('event-1', 1, {
				status: 'accepted',
			});

			await user.click(
				within(dialog).getByRole('button', { name: 'Continuar y crear contraseña' }),
			);

			const passphrase = within(dialog).getByText(
				/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/,
			);
			const generate = within(dialog).getByRole('button', { name: 'Generar 2 ZIP' });
			expect(generate).toBeDisabled();
			await user.click(
				within(dialog).getByLabelText(
					'Confirmo que guardé la contraseña en un lugar seguro.',
				),
			);
			expect(generate).toBeEnabled();
			await user.click(generate);

			expect(await within(dialog).findByText('Descarga preparada')).toBeInTheDocument();
			expect(mockedCreateZip).toHaveBeenCalledTimes(2);
			expect(mockedCreateZip).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					folderName: 'recuerdos-victoria-y-roberto',
					items: [acceptedItem],
					passphrase: passphrase.textContent,
				}),
			);
			expect(mockedCreateZip).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					folderName: 'recuerdos-victoria-y-roberto',
					items: [largeAcceptedItem],
					passphrase: passphrase.textContent,
				}),
			);
			expect(downloads.createObjectURL).toHaveBeenCalledTimes(2);
			expect(downloads.revokeObjectURL).toHaveBeenCalledTimes(2);
			const downloadNames = downloads.anchorClick.mock.contexts.map(
				(anchor) => (anchor as HTMLAnchorElement).download,
			);
			expect(downloadNames[0]).toMatch(
				/^recuerdos-victoria-y-roberto-\d{4}-\d{2}-\d{2}-parte-1\.zip$/,
			);
			expect(downloadNames[1]).toMatch(
				/^recuerdos-victoria-y-roberto-\d{4}-\d{2}-\d{2}-parte-2\.zip$/,
			);
		} finally {
			downloads.restore();
		}
	});

	it('exports the selection without a password when the host opts out', async () => {
		const user = userEvent.setup();
		const downloads = stubDownloads();
		mockedCreateZip.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }));
		try {
			await renderCatalog([acceptedItem, validatingItem]);
			await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
			await user.click(screen.getByRole('button', { name: /Familia$/ }));
			const bar = screen.getByRole('region', { name: 'Acciones para la selección' });
			await user.click(within(bar).getByRole('button', { name: 'Descargar' }));

			const dialog = await screen.findByRole('dialog', { name: 'Descargar recuerdos' });
			await within(dialog).findByText('1 archivos en 1 lote.');
			await user.click(
				within(dialog).getByLabelText('Proteger los ZIP con contraseña (recomendado)'),
			);
			expect(
				within(dialog).getByText(/Sin contraseña, cualquier persona/),
			).toBeInTheDocument();
			await user.click(within(dialog).getByRole('button', { name: 'Generar ZIP' }));

			expect(await within(dialog).findByText('Descarga preparada')).toBeInTheDocument();
			expect(mockedCreateZip).toHaveBeenCalledWith(
				expect.objectContaining({ items: [acceptedItem], passphrase: null }),
			);
			expect(within(dialog).queryByText(/Contraseña:/)).not.toBeInTheDocument();
		} finally {
			downloads.restore();
		}
	});

	it.each([
		[
			'a download cut by the connection',
			() => new TypeError('Failed to fetch'),
			'La descarga de un recuerdo se interrumpió. Revise su conexión y reintente este lote.',
			[acceptedItem, largeAcceptedItem],
		],
		[
			'a gateway timeout on a large video',
			() => new MemoriesRequestError(504),
			'La descarga de un recuerdo se interrumpió. Revise su conexión y reintente este lote.',
			[acceptedItem, largeAcceptedItem],
		],
		[
			'a file the host deleted meanwhile',
			() => new MemoriesRequestError(404),
			'Un recuerdo dejó de estar disponible. Revise el alcance y reintente este lote.',
			[acceptedItem],
		],
	])(
		'keeps the batch intact after %s, dropping only files that no longer exist',
		async (_label, failure, message, retriedItems) => {
			const user = userEvent.setup();
			const smallVideo = { ...largeAcceptedItem, sizeBytes: 2048 };
			const expectedRetry = retriedItems.map((item) =>
				item.id === largeAcceptedItem.id ? smallVideo : item,
			);
			organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem, smallVideo]));
			organizerApi.fetchItemBlob.mockImplementation(async (_eventId, itemId) => {
				if (itemId === smallVideo.id) throw failure();
				return new Blob(['photo']);
			});
			// The real archive builder fetches each file in turn and fails on the first error.
			mockedCreateZip.mockImplementation(async (input) => {
				for (const item of input.items) await input.fetchItemBlob(item);
				return new Blob(['zip'], { type: 'application/zip' });
			});

			render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
			await screen.findByRole('button', { name: /Familia$/ });
			await user.click(screen.getByRole('button', { name: 'Descargar todo' }));
			const dialog = await screen.findByRole('dialog', { name: 'Descargar recuerdos' });
			await user.click(
				await within(dialog).findByRole('button', { name: 'Continuar y crear contraseña' }),
			);
			await user.click(
				within(dialog).getByLabelText(
					'Confirmo que guardé la contraseña en un lugar seguro.',
				),
			);
			await user.click(within(dialog).getByRole('button', { name: 'Generar ZIP' }));

			expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
			expect(mockedCreateZip).toHaveBeenCalledTimes(1);

			organizerApi.fetchItemBlob.mockResolvedValue(new Blob(['media']));
			const downloads = stubDownloads();
			try {
				await user.click(within(dialog).getByRole('button', { name: 'Reintentar lote 1' }));

				expect(await within(dialog).findByText('Descarga preparada')).toBeInTheDocument();
				expect(mockedCreateZip).toHaveBeenLastCalledWith(
					expect.objectContaining({ items: expectedRetry }),
				);
			} finally {
				downloads.restore();
			}
		},
	);

	it('shows the host summary with totals, space used and the QR, without limits', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		const summary = await screen.findByLabelText('Resumen');
		const scoped = within(summary);
		expect(await scoped.findByText('Abierto')).toBeInTheDocument();
		expect(scoped.getByText('12')).toBeInTheDocument();
		expect(scoped.getByRole('img', { name: '12 % del espacio usado' })).toBeInTheDocument();
		expect(
			scoped.getByRole('img', { name: 'Código QR de la página de recuerdos' }),
		).toHaveAttribute('src', '/api/dashboard/memories/event-1/qr');
		expect(scoped.queryByText(/GB|Cloudflare|Complemento/)).not.toBeInTheDocument();
		expect(organizerApi.summary).toHaveBeenCalledWith('event-1', expect.any(AbortSignal));

		await user.click(scoped.getByRole('button', { name: 'Ver e imprimir' }));
		const qrDialog = await screen.findByRole('dialog', { name: 'QR para sus invitados' });
		expect(
			within(qrDialog).getByText('https://celebra-me.com/r/victoria-y-roberto'),
		).toBeInTheDocument();
		expect(within(qrDialog).getByRole('link', { name: 'Descargar QR' })).toHaveAttribute(
			'href',
			'/api/dashboard/memories/event-1/qr',
		);
		expect(
			within(qrDialog).getByRole('button', { name: 'Imprimir tarjeta' }),
		).toBeInTheDocument();
	});

	it('turns on the shared gallery and offers to copy, rotate or stop sharing', async () => {
		const user = userEvent.setup();
		const url = `https://celebra-me.com/r/victoria-y-roberto/galeria/${'a'.repeat(43)}`;
		organizerApi.share.mockResolvedValue({ shareUrl: url });
		await renderCatalog();

		const summary = within(await screen.findByLabelText('Resumen'));
		await user.click(await summary.findByRole('button', { name: 'Compartir galería' }));

		expect(organizerApi.share).toHaveBeenCalledWith('event-1', 'enable');
		expect(await summary.findByText(url)).toBeInTheDocument();
		expect(summary.getByRole('button', { name: 'Generar enlace nuevo' })).toBeInTheDocument();

		organizerApi.share.mockResolvedValue({ shareUrl: null });
		await user.click(summary.getByRole('button', { name: 'Dejar de compartir' }));
		expect(organizerApi.share).toHaveBeenLastCalledWith('event-1', 'disable');
		expect(
			await summary.findByRole('button', { name: 'Compartir galería' }),
		).toBeInTheDocument();
	});

	it('advises a download when little space remains', async () => {
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));
		organizerApi.summary.mockResolvedValue({
			...summaryOf(SPACES[0]),
			publicUrl: 'https://celebra-me.com/r/victoria-y-roberto',
			photos: 1204,
			videos: 96,
			guestsWithUploads: 112,
			expectedGuests: null,
			shareUrl: null,
			lastAcceptedAt: null,
			capacityRemainingPercent: 14,
		});

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		const summary = within(await screen.findByLabelText('Resumen'));
		expect(await summary.findByText(/Queda 14 % del espacio/)).toBeInTheDocument();
	});

	it('warns the host with a countdown when deletion is near and files remain', async () => {
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));
		organizerApi.summary.mockResolvedValue({
			...summaryOf(SPACES[0]),
			windowState: 'closed',
			retentionEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60_000).toISOString(),
			publicUrl: 'https://celebra-me.com/r/victoria-y-roberto',
			photos: 12,
			videos: 3,
			guestsWithUploads: 7,
			expectedGuests: null,
			shareUrl: null,
			lastAcceptedAt: null,
			capacityRemainingPercent: 88,
		});

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		const summary = within(await screen.findByLabelText('Resumen'));
		expect(await summary.findByRole('alert')).toHaveTextContent(
			'Sus recuerdos se eliminan en 3 días. Descárguelos ahora.',
		);
	});
});
