import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesOrganizer from '@/components/dashboard/memories/MemoriesOrganizer';
import {
	MemoriesRequestError,
	memoriesOrganizerApi,
	type OrganizerSpaceItem,
} from '@/lib/memories/client/api';
import { createEncryptedMemoriesZip } from '@/lib/memories/client/export';
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
		},
	};
});

jest.mock('@/lib/memories/client/export', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/export')>(
		'@/lib/memories/client/export',
	);
	return { ...actual, createEncryptedMemoriesZip: jest.fn() };
});

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const EVENT_STORAGE_KEY = 'memories-dashboard-event-id';

const organizerApi = memoriesOrganizerApi as jest.Mocked<typeof memoriesOrganizerApi>;
const mockedCreateZip = createEncryptedMemoriesZip as jest.MockedFunction<
	typeof createEncryptedMemoriesZip
>;

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
	organizerApi.summary.mockImplementation(async (eventId) => {
		const space = SPACES.find((entry) => entry.eventId === eventId) ?? SPACES[0];
		return {
			...summaryOf(space),
			publicUrl: `https://celebra-me.com/r/${space.publicSlug}`,
			photos: 12,
			videos: 3,
			guestsWithUploads: 7,
			lastAcceptedAt: null,
			capacityRemainingPercent: 88,
		};
	});
}

async function openMoreActions(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(screen.getByText('Más acciones'));
}

describe('MemoriesOrganizer island', () => {
	beforeEach(() => {
		window.localStorage.clear();
		resetOrganizerApi();
		mockedCreateZip.mockReset();
	});

	it('loads the initial event catalog through the API client and renders uploader names', async () => {
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem, validatingItem]));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		expect(await screen.findByText('Tía Ana')).toBeInTheDocument();
		expect(screen.getByText('Luis')).toBeInTheDocument();
		expect(organizerApi.listItems).toHaveBeenCalledTimes(1);
		expect(organizerApi.listItems).toHaveBeenCalledWith(
			'event-1',
			0,
			{ status: 'all', uploader: '', createdFrom: undefined, createdTo: undefined },
			expect.any(AbortSignal),
		);
		expect(screen.getByLabelText('Seleccionar recuerdo de Tía Ana')).toBeEnabled();
		expect(screen.getByLabelText('Seleccionar recuerdo de Luis')).toBeDisabled();
		expect(screen.getByRole('img', { name: 'Familia' })).toHaveAttribute(
			'src',
			'/api/dashboard/memories/event-1/items/accepted-item?mode=preview',
		);
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
		await screen.findByText('Tía Ana');

		await user.selectOptions(screen.getByDisplayValue('Boda de Victoria y Roberto'), 'event-2');

		expect(await screen.findByText('Luis')).toBeInTheDocument();
		expect(screen.queryByText('Tía Ana')).not.toBeInTheDocument();
		expect(organizerApi.listItems).toHaveBeenLastCalledWith(
			'event-2',
			0,
			expect.objectContaining({ status: 'all', uploader: '' }),
			expect.any(AbortSignal),
		);
		expect(window.localStorage.getItem(EVENT_STORAGE_KEY)).toBe('event-2');
	});

	it('sends UTC day bounds computed in the event time zone when a date filter is applied', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByText('Tía Ana');

		fireEvent.change(screen.getByLabelText(/Fecha del evento/), {
			target: { value: '2026-10-30' },
		});
		await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

		await waitFor(() => expect(organizerApi.listItems).toHaveBeenCalledTimes(2));
		expect(organizerApi.listItems).toHaveBeenLastCalledWith(
			'event-1',
			0,
			{
				status: 'all',
				uploader: '',
				createdFrom: '2026-10-30T07:00:00.000Z',
				createdTo: '2026-10-31T07:00:00.000Z',
			},
			expect.any(AbortSignal),
		);
	});

	it('rejects a memory through the CSRF-aware API client after confirmation', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));
		organizerApi.updateItem.mockResolvedValue({ ...acceptedItem, status: 'rejected' });

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByText('Tía Ana');

		await openMoreActions(user);
		await user.click(screen.getByRole('button', { name: 'Rechazar' }));
		const dialog = await screen.findByRole('dialog', { name: 'Rechazar recuerdo' });
		await user.click(within(dialog).getByRole('button', { name: 'Rechazar recuerdo' }));

		await waitFor(() =>
			expect(organizerApi.updateItem).toHaveBeenCalledWith('event-1', 'accepted-item', {
				status: 'rejected',
			}),
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(organizerApi.listItems).toHaveBeenCalledTimes(2);
	});

	it('deletes a memory through the API client after confirmation', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));
		organizerApi.deleteItem.mockResolvedValue(undefined);

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByText('Tía Ana');

		await openMoreActions(user);
		await user.click(screen.getByRole('button', { name: 'Eliminar' }));
		const dialog = await screen.findByRole('dialog', { name: 'Eliminar recuerdo' });
		await user.click(within(dialog).getByRole('button', { name: 'Eliminar recuerdo' }));

		await waitFor(() =>
			expect(organizerApi.deleteItem).toHaveBeenCalledWith('event-1', 'accepted-item'),
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('revokes the uploader session by guest alias through the API client', async () => {
		const user = userEvent.setup();
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));
		organizerApi.revokeUploader.mockResolvedValue(undefined);

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);
		await screen.findByText('Tía Ana');

		await openMoreActions(user);
		await user.click(screen.getByRole('button', { name: 'Bloquear sesión' }));
		const dialog = await screen.findByRole('dialog', { name: 'Bloquear futuras cargas' });
		expect(
			within(dialog).getByText(/Se bloquearán futuras cargas de Tía Ana/),
		).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: 'Bloquear sesión' }));

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

	it('shows the authorization error when the catalog request is forbidden', async () => {
		organizerApi.listItems.mockRejectedValue(new MemoriesRequestError(403, 'forbidden'));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'No tiene autorización para este evento.',
		);
	});

	it('exports every accepted page into encrypted ZIP batches named after the public slug', async () => {
		const user = userEvent.setup();
		const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
		const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
		const createObjectURL = jest.fn(() => 'blob:memories-export');
		const revokeObjectURL = jest.fn();
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: createObjectURL,
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: revokeObjectURL,
		});
		const anchorClick = jest
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => undefined);

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
			await screen.findByText('Tía Ana');

			await user.click(screen.getByRole('button', { name: 'Descargar todos los aprobados' }));

			const dialog = await screen.findByRole('dialog', {
				name: 'Descargar recuerdos cifrados',
			});
			expect(
				await within(dialog).findByText('2 archivos aprobados en 2 lotes.'),
			).toBeInTheDocument();
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
			expect(createObjectURL).toHaveBeenCalledTimes(2);
			expect(revokeObjectURL).toHaveBeenCalledTimes(2);
			expect(anchorClick).toHaveBeenCalledTimes(2);
			const downloadNames = anchorClick.mock.contexts.map(
				(anchor) => (anchor as HTMLAnchorElement).download,
			);
			expect(downloadNames[0]).toMatch(
				/^recuerdos-victoria-y-roberto-\d{4}-\d{2}-\d{2}-parte-1\.zip$/,
			);
			expect(downloadNames[1]).toMatch(
				/^recuerdos-victoria-y-roberto-\d{4}-\d{2}-\d{2}-parte-2\.zip$/,
			);
		} finally {
			anchorClick.mockRestore();
			if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
			else delete (URL as { createObjectURL?: unknown }).createObjectURL;
			if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
			else delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
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
			await screen.findByText('Tía Ana');
			await user.click(screen.getByRole('button', { name: 'Descargar todos los aprobados' }));
			const dialog = await screen.findByRole('dialog', {
				name: 'Descargar recuerdos cifrados',
			});
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
			const createObjectURL = jest.fn(() => 'blob:memories-export');
			const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
			const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
			Object.defineProperty(URL, 'createObjectURL', {
				configurable: true,
				value: createObjectURL,
			});
			Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
			const anchorClick = jest
				.spyOn(HTMLAnchorElement.prototype, 'click')
				.mockImplementation(() => undefined);
			try {
				await user.click(within(dialog).getByRole('button', { name: 'Reintentar lote 1' }));

				expect(await within(dialog).findByText('Descarga preparada')).toBeInTheDocument();
				expect(mockedCreateZip).toHaveBeenLastCalledWith(
					expect.objectContaining({ items: expectedRetry }),
				);
			} finally {
				anchorClick.mockRestore();
				if (createDescriptor)
					Object.defineProperty(URL, 'createObjectURL', createDescriptor);
				else delete (URL as { createObjectURL?: unknown }).createObjectURL;
				if (revokeDescriptor)
					Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
				else delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
			}
		},
	);

	it('shows the host summary with totals, the share link and the QR download, without limits', async () => {
		organizerApi.listItems.mockResolvedValue(listPayload([acceptedItem]));

		render(<MemoriesOrganizer spaces={SPACES} initialEventId="event-1" />);

		const summary = await screen.findByLabelText('Resumen');
		const scoped = within(summary);
		expect(await scoped.findByText('Abierto')).toBeInTheDocument();
		expect(scoped.getByText('12')).toBeInTheDocument();
		expect(scoped.getByText('88 %')).toBeInTheDocument();
		expect(scoped.getByText('https://celebra-me.com/r/victoria-y-roberto')).toBeInTheDocument();
		expect(scoped.getByRole('link', { name: 'Descargar QR' })).toHaveAttribute(
			'href',
			'/api/dashboard/memories/event-1/qr',
		);
		expect(scoped.queryByText(/GB|Cloudflare|Complemento/)).not.toBeInTheDocument();
		expect(organizerApi.summary).toHaveBeenCalledWith('event-1', expect.any(AbortSignal));
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
