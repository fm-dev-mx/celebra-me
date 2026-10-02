import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesAdmin from '@/components/dashboard/memories/MemoriesAdmin';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';
import type { MemoriesAdminSpaceItem, MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';

jest.mock('@/lib/memories/client/api', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/api')>(
		'@/lib/memories/client/api',
	);
	return {
		...actual,
		memoriesAdminApi: {
			list: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			platformUsage: jest.fn(),
			qrUrl: (eventId: string) => `/api/dashboard/admin/memories/${eventId}/qr`,
		},
	};
});

const adminApi = memoriesAdminApi as jest.Mocked<typeof memoriesAdminApi>;

const CANDIDATE: AdminSpaceCandidate = {
	eventId: 'event-1',
	eventSlug: 'victoria-y-roberto',
	eventTitle: 'Boda de Victoria y Roberto',
	eventDate: '2099-10-30',
	defaults: {
		publicSlug: 'victoria-y-roberto',
		timeZone: 'America/Mazatlan',
		uploadStartsLocal: '2026-10-30T12:00',
		uploadEndsLocal: '2026-11-01T23:59',
		retentionEndsLocal: '2027-01-30T00:00',
		limits: {
			maxEventObjects: 2000,
			maxEventBytes: 8_000_000_000,
			maxSessionFiles: 20,
			maxSessionVideos: 5,
			maxSessionBytes: 512 * 1024 * 1024,
		},
	},
};

const OPEN_SPACE: MemoriesSpaceRecord = {
	eventId: 'event-2',
	eventSlug: 'xv-de-sofia',
	eventTitle: 'XV de Sofía',
	publicSlug: 'xv-de-sofia',
	enabled: true,
	timeZone: 'America/Mexico_City',
	uploadStartsAt: '2020-01-01T06:00:00.000Z',
	uploadEndsAt: '2099-01-01T06:00:00.000Z',
	retentionEndsAt: '2099-06-01T06:00:00.000Z',
	entitlement: 'package',
	createdAt: '2020-01-01T00:00:00.000Z',
	updatedAt: '2020-01-01T00:00:00.000Z',
	maxEventObjects: 2000,
	maxEventBytes: 8_000_000_000,
	maxSessionFiles: 20,
	maxSessionVideos: 5,
	maxSessionBytes: 512 * 1024 * 1024,
};

function createdSpace(): MemoriesSpaceRecord {
	return {
		...OPEN_SPACE,
		eventId: CANDIDATE.eventId,
		eventSlug: CANDIDATE.eventSlug,
		eventTitle: CANDIDATE.eventTitle,
		publicSlug: CANDIDATE.defaults.publicSlug,
		timeZone: CANDIDATE.defaults.timeZone,
		entitlement: 'addon',
	};
}

const PAST_CANDIDATE: AdminSpaceCandidate = {
	...CANDIDATE,
	eventId: 'event-past',
	eventSlug: 'xv-de-leslie',
	eventTitle: 'XV años de Leslie',
	eventDate: '2020-05-01',
	defaults: { ...CANDIDATE.defaults, publicSlug: 'xv-de-leslie' },
};

const EMPTY_USAGE: MemoriesAdminSpaceItem['usage'] = {
	photos: 0,
	videos: 0,
	guestsWithUploads: 0,
	sessions: 0,
	residentObjects: 0,
	residentBytes: 0,
	inFlight: 0,
	rejected: 0,
	lastAcceptedAt: null,
};

function adminItem(
	space: MemoriesSpaceRecord,
	usage: Partial<MemoriesAdminSpaceItem['usage']> = {},
): MemoriesAdminSpaceItem {
	return { ...space, usage: { ...EMPTY_USAGE, ...usage } };
}

const TOTALS = { residentBytes: 0, committedBytes: 8_000_000_000 };

describe('MemoriesAdmin island', () => {
	beforeEach(() => {
		adminApi.list.mockReset();
		adminApi.create.mockReset();
		adminApi.update.mockReset();
		adminApi.platformUsage.mockReset();
		adminApi.platformUsage.mockResolvedValue({ kind: 'unconfigured' });
	});

	it('activates a space from the event picker with the prefilled window and plan', async () => {
		const user = userEvent.setup();
		adminApi.list
			.mockResolvedValueOnce({
				items: [],
				totals: TOTALS,
				candidates: [CANDIDATE, PAST_CANDIDATE],
			})
			.mockResolvedValueOnce({
				items: [adminItem(createdSpace())],
				totals: TOTALS,
				candidates: [],
			});
		adminApi.create.mockResolvedValue(createdSpace());

		render(<MemoriesAdmin />);

		await user.click(await screen.findByRole('button', { name: 'Activar evento' }));
		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).queryByText('XV años de Leslie')).not.toBeInTheDocument();
		await user.click(
			within(dialog).getByRole('button', { name: /Mostrar eventos anteriores/ }),
		);
		expect(within(dialog).getByText('XV años de Leslie')).toBeInTheDocument();

		await user.type(within(dialog).getByLabelText('Buscar evento publicado'), 'victoria');
		expect(within(dialog).queryByText('XV años de Leslie')).not.toBeInTheDocument();
		await user.click(
			within(dialog).getByRole('button', { name: /Boda de Victoria y Roberto/ }),
		);

		expect(within(dialog).getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
		expect(within(dialog).getByLabelText('Zona horaria')).toHaveValue('America/Mazatlan');
		expect(within(dialog).getByLabelText('Apertura de carga')).toHaveValue('2026-10-30T12:00');
		expect(within(dialog).getByLabelText('Cierre de carga')).toHaveValue('2026-11-01T23:59');
		expect(within(dialog).getByLabelText('Fin de retención')).toHaveValue('2027-01-30T00:00');
		expect(within(dialog).getByLabelText('Origen comercial')).toHaveValue('addon');
		expect(within(dialog).getByLabelText('Perfil de cupo')).toHaveValue('standard');
		expect(within(dialog).getByLabelText('Almacenamiento del evento (GB)')).toHaveValue(8);
		expect(within(dialog).getByLabelText('Almacenamiento por invitado (MB)')).toHaveValue(512);
		expect(
			within(dialog).getByText(/https:\/\/celebra-me\.com\/r\/victoria-y-roberto/),
		).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: 'Activar espacio' }));

		await waitFor(() => expect(adminApi.create).toHaveBeenCalledTimes(1));
		expect(adminApi.create).toHaveBeenCalledWith({
			eventId: 'event-1',
			publicSlug: 'victoria-y-roberto',
			timeZone: 'America/Mazatlan',
			uploadStartsLocal: '2026-10-30T12:00',
			uploadEndsLocal: '2026-11-01T23:59',
			retentionEndsLocal: '2027-01-30T00:00',
			entitlement: 'addon',
			enabled: true,
			limits: {
				maxEventObjects: 2000,
				maxEventBytes: 8_000_000_000,
				maxSessionFiles: 20,
				maxSessionVideos: 5,
				maxSessionBytes: 512 * 1024 * 1024,
			},
		});
		expect(
			await screen.findByText(
				'Espacio activado. URL pública: https://celebra-me.com/r/victoria-y-roberto',
			),
		).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(2);
	});

	it('shows each space with its state, usage and QR, and pauses only after confirmation', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({
			items: [
				adminItem(OPEN_SPACE, {
					photos: 40,
					videos: 6,
					guestsWithUploads: 12,
					sessions: 15,
					residentBytes: 2_000_000_000,
					residentObjects: 46,
					rejected: 2,
				}),
			],
			totals: TOTALS,
			candidates: [],
		});
		adminApi.update.mockResolvedValue({ ...OPEN_SPACE, enabled: false });

		render(<MemoriesAdmin />);

		const card = within(await screen.findByRole('article', { name: 'XV de Sofía' }));
		expect(card.getByText('https://celebra-me.com/r/xv-de-sofia')).toBeInTheDocument();
		expect(card.getByText('Abierto')).toHaveClass('dashboard-badge', 'dashboard-badge--active');
		expect(card.getByText('40')).toBeInTheDocument();
		expect(card.getByText(/de 15 registrados/)).toBeInTheDocument();
		expect(card.getByText('2 GB')).toBeInTheDocument();
		expect(card.getByText(/2 rechazados/)).toBeInTheDocument();
		expect(card.getByRole('link', { name: 'Descargar QR: XV de Sofía' })).toHaveAttribute(
			'href',
			'/api/dashboard/admin/memories/event-2/qr',
		);

		await user.click(card.getByRole('button', { name: 'Pausar' }));
		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByText(/el QR impreso seguirá funcionando/)).toBeInTheDocument();
		expect(adminApi.update).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole('button', { name: 'Pausar' }));

		await waitFor(() =>
			expect(adminApi.update).toHaveBeenCalledWith('event-2', { enabled: false }),
		);
		expect(await screen.findByText('Espacio en pausa.')).toBeInTheDocument();
		await waitFor(() => expect(adminApi.list).toHaveBeenCalledTimes(2));
	});

	it('keeps the form open with the conflict message when activation returns 409', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({ items: [], totals: TOTALS, candidates: [CANDIDATE] });
		adminApi.create.mockRejectedValue(new MemoriesRequestError(409, 'conflict'));

		render(<MemoriesAdmin />);

		await user.click(await screen.findByRole('button', { name: 'Activar evento' }));
		await user.click(await screen.findByRole('button', { name: /Boda de Victoria y Roberto/ }));
		await user.click(screen.getByRole('button', { name: 'Activar espacio' }));

		expect(
			await screen.findByText('El evento ya tiene recuerdos o el slug público está en uso.'),
		).toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
	});

	it('falls back to the recorded storage and warns when commitments exceed the free tier', async () => {
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: { residentBytes: 1_200_000_000, committedBytes: 16_000_000_000 },
			candidates: [],
		});

		render(<MemoriesAdmin />);

		expect(
			await screen.findByText(/falta configurar el token de solo lectura/),
		).toBeInTheDocument();
		expect(screen.getByText('Almacenamiento registrado')).toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent(
			/Comprometido por espacios vigentes: 16 GB de 10 GB/,
		);
	});

	it('renders live Cloudflare meters with their warning level', async () => {
		adminApi.list.mockResolvedValue({ items: [], totals: TOTALS, candidates: [] });
		adminApi.platformUsage.mockResolvedValue({
			kind: 'ok',
			fetchedAt: '2026-10-24T12:00:00.000Z',
			r2StorageBytes: { used: 9_500_000_000, limit: 10_000_000_000 },
			r2ClassAOperations: { used: 3_100, limit: 1_000_000 },
			r2ClassBOperations: { used: 12_000, limit: 10_000_000 },
			workersRequests: { used: 75_000, limit: 100_000 },
			durableObjectsRequests: { used: null, limit: 100_000 },
		});

		render(<MemoriesAdmin />);

		const storage = await screen.findByRole('meter', { name: 'Almacenamiento R2' });
		expect(storage).toHaveAttribute('aria-valuenow', '95');
		expect(storage.closest('.memories-meter')).toHaveClass('memories-meter--critical');
		expect(
			screen
				.getByRole('meter', { name: 'Solicitudes Workers (hoy)' })
				.closest('.memories-meter'),
		).toHaveClass('memories-meter--warning');
		expect(screen.getByText('Sin dato')).toBeInTheDocument();
		expect(screen.getByText(/Todavía no hay espacios/)).toBeInTheDocument();
	});
});
