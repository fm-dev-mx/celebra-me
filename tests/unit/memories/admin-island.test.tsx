import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesAdmin from '@/components/dashboard/memories/MemoriesAdmin';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';
import type { MemoriesAdminSpaceItem, MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import { MEMORIES_LIMIT_PROFILES } from '@/lib/memories/contract/limits';

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
			qrUrl: (eventId: string) => `/api/dashboard/admin/memories/${eventId}/qr`,
		},
	};
});

const adminApi = memoriesAdminApi as jest.Mocked<typeof memoriesAdminApi>;
const DAY_MS = 24 * 60 * 60 * 1000;

const CANDIDATE: AdminSpaceCandidate = {
	eventId: 'event-1',
	eventSlug: 'victoria-y-roberto',
	eventTitle: 'Boda de Victoria y Roberto',
	eventDate: '2099-10-30',
	defaults: {
		publicSlug: 'victoria-y-roberto',
		timeZone: 'America/Mazatlan',
		uploadStartsLocal: '2099-10-23T00:00',
		uploadEndsLocal: '2099-11-07T00:00',
		retentionEndsLocal: '2100-01-06T00:00',
		limits: { ...MEMORIES_LIMIT_PROFILES.standard },
	},
};

const PAST_CANDIDATE: AdminSpaceCandidate = {
	...CANDIDATE,
	eventId: 'event-past',
	eventSlug: 'xv-de-leslie',
	eventTitle: 'XV años de Leslie',
	eventDate: '2020-05-01',
	defaults: { ...CANDIDATE.defaults, publicSlug: 'xv-de-leslie' },
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
	expectedGuests: null,
	adminNote: null,
	shareVersion: 0,
	shareEnabledAt: null,
	createdAt: '2020-01-01T00:00:00.000Z',
	updatedAt: '2020-01-01T00:00:00.000Z',
	maxEventObjects: 2000,
	maxEventBytes: 8_000_000_000,
	maxSessionFiles: 20,
	maxSessionVideos: 5,
	maxSessionBytes: 512 * 1024 * 1024,
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
	extra: Partial<
		Pick<MemoriesAdminSpaceItem, 'eventDate' | 'lastHostDownloadAt' | 'hasOwner'>
	> = {},
): MemoriesAdminSpaceItem {
	return {
		...space,
		usage: { ...EMPTY_USAGE, ...usage },
		eventDate: null,
		lastHostDownloadAt: null,
		hasOwner: true,
		...extra,
	};
}

function createdSpace(): MemoriesSpaceRecord {
	return {
		...OPEN_SPACE,
		...MEMORIES_LIMIT_PROFILES.standard,
		eventId: CANDIDATE.eventId,
		eventSlug: CANDIDATE.eventSlug,
		eventTitle: CANDIDATE.eventTitle,
		publicSlug: CANDIDATE.defaults.publicSlug,
		timeZone: CANDIDATE.defaults.timeZone,
		entitlement: 'addon',
	};
}

/** A closed space whose retention ends in `days`, so the deletion warning applies. */
function closingSpace(days: number): MemoriesSpaceRecord {
	const now = Date.now();
	return {
		...OPEN_SPACE,
		uploadStartsAt: new Date(now - 60 * DAY_MS).toISOString(),
		uploadEndsAt: new Date(now - 40 * DAY_MS).toISOString(),
		retentionEndsAt: new Date(now + days * DAY_MS - 60_000).toISOString(),
	};
}

const NO_COMMITMENT = { residentBytes: 0, committedBytes: 0 };

async function openFormFor(user: ReturnType<typeof userEvent.setup>, title: RegExp) {
	await user.click(await screen.findByRole('button', { name: 'Activar evento' }));
	const dialog = await screen.findByRole('dialog');
	await user.click(await within(dialog).findByRole('button', { name: title }));
	return within(dialog);
}

describe('MemoriesAdmin island', () => {
	beforeEach(() => {
		adminApi.list.mockReset();
		adminApi.create.mockReset();
		adminApi.update.mockReset();
	});

	it('activates a space from the event picker with the planning inputs', async () => {
		const user = userEvent.setup();
		adminApi.list
			.mockResolvedValueOnce({
				items: [],
				totals: NO_COMMITMENT,
				candidates: [CANDIDATE, PAST_CANDIDATE],
			})
			.mockResolvedValueOnce({
				items: [adminItem(createdSpace())],
				totals: NO_COMMITMENT,
				candidates: [],
			});
		adminApi.create.mockResolvedValue(createdSpace());

		render(<MemoriesAdmin />);

		await user.click(await screen.findByRole('button', { name: 'Activar evento' }));
		const dialog = within(await screen.findByRole('dialog'));
		expect(dialog.queryByText('XV años de Leslie')).not.toBeInTheDocument();
		await user.click(dialog.getByRole('button', { name: /Mostrar eventos anteriores/ }));
		expect(dialog.getByText('XV años de Leslie')).toBeInTheDocument();

		await user.type(dialog.getByLabelText('Buscar evento publicado'), 'victoria');
		expect(dialog.queryByText('XV años de Leslie')).not.toBeInTheDocument();
		await user.click(dialog.getByRole('button', { name: /Boda de Victoria y Roberto/ }));

		expect(
			dialog.getByText('Boda de Victoria y Roberto · 30 de octubre de 2099'),
		).toBeInTheDocument();
		expect(dialog.getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
		expect(dialog.getByLabelText('Zona horaria')).toHaveValue('America/Mazatlan');
		expect(dialog.getByLabelText('Apertura de carga')).toHaveValue('2099-10-23T00:00');
		expect(dialog.getByLabelText('Origen comercial')).toHaveValue('addon');
		expect(dialog.getByLabelText('Perfil de cupo')).toHaveValue('standard');
		expect(dialog.getByLabelText('Almacenamiento del evento (GB)')).toHaveValue(5);
		expect(dialog.getByLabelText('Almacenamiento por invitado (MB)')).toHaveValue(300);
		expect(
			dialog.getByText(/Abre 7 días antes del evento y cierra 8 días después\./),
		).toBeInTheDocument();
		expect(dialog.getByText(/se conservan 75 días desde la apertura/)).toBeInTheDocument();
		expect(dialog.getByText(/cada video: hasta 60 s y 80 MB/)).toBeInTheDocument();
		expect(dialog.getByText(/quedarían comprometidos 5 GB de los 10 GB/)).toBeInTheDocument();
		expect(dialog.queryByRole('checkbox')).not.toBeInTheDocument();

		await user.type(dialog.getByLabelText('Invitados esperados (opcional)'), '150');
		expect(
			dialog.getByText(/alcanza para unos 100 invitados con uso típico y usted espera 150/),
		).toBeInTheDocument();
		await user.type(dialog.getByLabelText('Nota'), 'Pago sintético 001');

		await user.click(dialog.getByRole('button', { name: 'Activar espacio' }));

		await waitFor(() => expect(adminApi.create).toHaveBeenCalledTimes(1));
		expect(adminApi.create).toHaveBeenCalledWith({
			eventId: 'event-1',
			publicSlug: 'victoria-y-roberto',
			timeZone: 'America/Mazatlan',
			uploadStartsLocal: '2099-10-23T00:00',
			uploadEndsLocal: '2099-11-07T00:00',
			retentionEndsLocal: '2100-01-06T00:00',
			entitlement: 'addon',
			enabled: true,
			limits: { ...MEMORIES_LIMIT_PROFILES.standard },
			expectedGuests: 150,
			adminNote: 'Pago sintético 001',
		});
		expect(
			await screen.findByText(
				'Espacio activado. URL pública: https://celebra-me.com/r/victoria-y-roberto',
			),
		).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(2);
	});

	it('requires an acknowledgement before committing past the free storage', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: { residentBytes: 0, committedBytes: 8_000_000_000 },
			candidates: [CANDIDATE],
		});
		adminApi.create.mockResolvedValue(createdSpace());

		render(<MemoriesAdmin />);
		const dialog = await openFormFor(user, /Boda de Victoria y Roberto/);

		expect(dialog.getByText(/quedarían comprometidos 13 GB de los 10 GB/)).toBeInTheDocument();
		const submit = dialog.getByRole('button', { name: 'Activar espacio' });
		expect(submit).toBeDisabled();

		await user.click(
			dialog.getByLabelText('Entiendo que puede generar cargos de almacenamiento'),
		);
		expect(submit).toBeEnabled();
		await user.click(submit);

		await waitFor(() => expect(adminApi.create).toHaveBeenCalledTimes(1));
	});

	it('explains schedule problems next to the field and blocks the save', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({
			items: [],
			totals: NO_COMMITMENT,
			candidates: [CANDIDATE],
		});

		render(<MemoriesAdmin />);
		const dialog = await openFormFor(user, /Boda de Victoria y Roberto/);
		const submit = dialog.getByRole('button', { name: 'Activar espacio' });

		fireEvent.change(dialog.getByLabelText('Fin de retención'), {
			target: { value: '2100-06-01T00:00' },
		});
		expect(
			dialog.getByText('La retención no puede superar 150 días desde la apertura.'),
		).toBeInTheDocument();
		expect(submit).toBeDisabled();

		fireEvent.change(dialog.getByLabelText('Fin de retención'), {
			target: { value: '2100-01-06T00:00' },
		});
		fireEvent.change(dialog.getByLabelText('Cierre de carga'), {
			target: { value: '2099-10-22T00:00' },
		});
		expect(dialog.getByText('El cierre debe ser posterior a la apertura.')).toBeInTheDocument();
		expect(submit).toBeDisabled();
		expect(adminApi.create).not.toHaveBeenCalled();
	});

	it('shows guest links on the origin the server reports for this environment', async () => {
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: NO_COMMITMENT,
			candidates: [],
			publicOrigin: 'http://localhost:4321',
		});

		render(<MemoriesAdmin />);

		const card = within(await screen.findByRole('article', { name: 'XV de Sofía' }));
		expect(card.getByText('http://localhost:4321/r/xv-de-sofia')).toBeInTheDocument();
	});

	it('shows each space with its state, usage and QR, and pauses only after confirmation', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({
			items: [
				adminItem(
					{ ...OPEN_SPACE, expectedGuests: 150, adminNote: 'Pago sintético 001' },
					{
						photos: 40,
						videos: 6,
						guestsWithUploads: 12,
						sessions: 15,
						residentBytes: 2_000_000_000,
						residentObjects: 46,
						rejected: 2,
					},
				),
			],
			totals: NO_COMMITMENT,
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
		expect(card.getByText(/12 de 150 invitados esperados/)).toBeInTheDocument();
		expect(card.getByText(/El anfitrión aún no descarga/)).toBeInTheDocument();
		expect(card.getByText('Pago sintético 001')).toBeInTheDocument();
		expect(card.queryByRole('alert')).not.toBeInTheDocument();
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

	it('flags spaces about to be deleted whose host never downloaded, and lists them first', async () => {
		adminApi.list.mockResolvedValue({
			items: [
				adminItem(OPEN_SPACE),
				adminItem(
					{ ...closingSpace(5), eventId: 'event-3', eventTitle: 'Boda sin descargar' },
					{ photos: 3 },
				),
				adminItem(
					{ ...closingSpace(5), eventId: 'event-4', eventTitle: 'Boda ya descargada' },
					{ photos: 3 },
					{ lastHostDownloadAt: '2026-11-10T18:00:00.000Z' },
				),
			],
			totals: NO_COMMITMENT,
			candidates: [],
		});

		render(<MemoriesAdmin />);

		const pending = within(await screen.findByRole('article', { name: 'Boda sin descargar' }));
		expect(pending.getByRole('alert')).toHaveTextContent('Se borra en 5 días · sin descargar');
		const downloaded = within(screen.getByRole('article', { name: 'Boda ya descargada' }));
		expect(downloaded.queryByRole('alert')).not.toBeInTheDocument();
		expect(downloaded.getByText(/El anfitrión descargó por última vez/)).toBeInTheDocument();
		expect(
			screen.getByText(/1 espacio se borra pronto y su anfitrión aún no descarga/),
		).toBeInTheDocument();
		expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Boda sin descargar');
	});

	it('warns when no main host can see a space', async () => {
		adminApi.list.mockResolvedValue({
			items: [
				adminItem(
					{ ...OPEN_SPACE, eventId: 'event-5', eventTitle: 'Boda sin anfitrión' },
					{},
					{ hasOwner: false },
				),
				adminItem({ ...OPEN_SPACE, eventId: 'event-6', eventTitle: 'Boda con anfitrión' }),
			],
			totals: NO_COMMITMENT,
			candidates: [],
		});

		render(<MemoriesAdmin />);

		const orphan = within(await screen.findByRole('article', { name: 'Boda sin anfitrión' }));
		expect(orphan.getByRole('alert')).toHaveTextContent(
			'Ningún anfitrión principal puede ver este espacio',
		);
		const owned = within(screen.getByRole('article', { name: 'Boda con anfitrión' }));
		expect(owned.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('keeps the form open with the conflict message when activation returns 409', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({
			items: [],
			totals: NO_COMMITMENT,
			candidates: [CANDIDATE],
		});
		adminApi.create.mockRejectedValue(new MemoriesRequestError(409, 'conflict'));

		render(<MemoriesAdmin />);
		const dialog = await openFormFor(user, /Boda de Victoria y Roberto/);
		await user.click(dialog.getByRole('button', { name: 'Activar espacio' }));

		expect(
			await screen.findByText('El evento ya tiene recuerdos o el slug público está en uso.'),
		).toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
	});

	it('edits a space with its stored planning inputs and can clear them', async () => {
		const user = userEvent.setup();
		const stored = {
			...OPEN_SPACE,
			uploadStartsAt: '2099-01-01T06:00:00.000Z',
			uploadEndsAt: '2099-01-15T06:00:00.000Z',
			retentionEndsAt: '2099-03-01T06:00:00.000Z',
			expectedGuests: 150,
			adminNote: 'Pago sintético 001',
		};
		adminApi.list.mockResolvedValue({
			items: [adminItem(stored, {}, { eventDate: '2099-01-08' })],
			totals: { residentBytes: 0, committedBytes: 8_000_000_000 },
			candidates: [],
		});
		adminApi.update.mockResolvedValue(stored);

		render(<MemoriesAdmin />);
		const card = within(await screen.findByRole('article', { name: 'XV de Sofía' }));
		await user.click(card.getByRole('button', { name: 'Editar' }));
		const dialog = within(await screen.findByRole('dialog'));

		expect(dialog.getByLabelText('Slug público')).toBeDisabled();
		expect(dialog.getByLabelText('Invitados esperados (opcional)')).toHaveValue(150);
		expect(dialog.getByLabelText('Nota')).toHaveValue('Pago sintético 001');
		// Its own 8 GB is not counted twice against the allowance.
		expect(dialog.getByText(/quedarían comprometidos 8 GB de los 10 GB/)).toBeInTheDocument();

		await user.clear(dialog.getByLabelText('Invitados esperados (opcional)'));
		await user.clear(dialog.getByLabelText('Nota'));
		await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(adminApi.update).toHaveBeenCalledTimes(1));
		expect(adminApi.update).toHaveBeenCalledWith(
			'event-2',
			expect.objectContaining({ expectedGuests: null, adminNote: null }),
		);
	});

	it('warns when commitments exceed the free tier', async () => {
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: { residentBytes: 1_200_000_000, committedBytes: 16_000_000_000 },
			candidates: [],
		});

		render(<MemoriesAdmin />);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			/Comprometido por espacios vigentes: 16 GB de 10 GB/,
		);
	});

	it('lists one notice per missing setting with the feature, command and destination', async () => {
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: NO_COMMITMENT,
			candidates: [],
			readiness: {
				missing: ['shareSecret', 'uploadOrigin'],
				unreachable: ['retrievalOrigin'],
			},
		});

		render(<MemoriesAdmin />);

		const region = await screen.findByRole('region', {
			name: 'Configuración pendiente de Recuerdos',
		});
		const notices = within(region).getAllByRole('status');
		expect(notices).toHaveLength(3);
		expect(notices[0]).toHaveTextContent('Falta MEMORIES_SHARE_SECRET');
		expect(notices[0]).toHaveTextContent('randomBytes(32)');
		expect(notices[0]).toHaveTextContent('.env.local');
		expect(notices[0]).toHaveTextContent('Vercel');
		expect(notices[1]).toHaveTextContent('Falta MEMORIES_PRIVATE_UPLOAD_ORIGIN');
		expect(notices[2]).toHaveTextContent('El Worker de lectura no responde');
	});

	it('shows no configuration notice when nothing is missing', async () => {
		adminApi.list.mockResolvedValue({
			items: [adminItem(OPEN_SPACE)],
			totals: NO_COMMITMENT,
			candidates: [],
			readiness: { missing: [], unreachable: [] },
		});

		render(<MemoriesAdmin />);

		await screen.findByRole('article', { name: 'XV de Sofía' });
		expect(
			screen.queryByRole('region', { name: 'Configuración pendiente de Recuerdos' }),
		).not.toBeInTheDocument();
	});

	it('explains a failed load with its fix and recovers on retry', async () => {
		const user = userEvent.setup();
		adminApi.list
			.mockRejectedValueOnce(new MemoriesRequestError(503, 'schema_out_of_date'))
			.mockResolvedValueOnce({
				items: [adminItem(OPEN_SPACE)],
				totals: NO_COMMITMENT,
				candidates: [],
			});

		render(<MemoriesAdmin />);

		const alert = await screen.findByText(/no tiene las migraciones más recientes/);
		expect(alert.closest('[role="alert"]')).toHaveTextContent(
			'pnpm db:migrate -- --target local',
		);
		expect(screen.queryByText(/Todavía no hay espacios/)).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Reintentar' }));

		expect(await screen.findByRole('article', { name: 'XV de Sofía' })).toBeInTheDocument();
		expect(screen.queryByText(/no tiene las migraciones/)).not.toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(2);
	});
});
