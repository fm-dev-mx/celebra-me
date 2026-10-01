import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesAdmin from '@/components/dashboard/memories/MemoriesAdmin';
import {
	MemoriesRequestError,
	memoriesAdminApi,
	type AdminSpaceCandidate,
} from '@/lib/memories/client/api';
import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';

jest.mock('@/lib/memories/client/api', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/api')>(
		'@/lib/memories/client/api',
	);
	return {
		...actual,
		memoriesAdminApi: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
	};
});

const adminApi = memoriesAdminApi as jest.Mocked<typeof memoriesAdminApi>;

const CANDIDATE: AdminSpaceCandidate = {
	eventId: 'event-1',
	eventSlug: 'victoria-y-roberto',
	eventTitle: 'Boda de Victoria y Roberto',
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

describe('MemoriesAdmin island', () => {
	beforeEach(() => {
		adminApi.list.mockReset();
		adminApi.create.mockReset();
		adminApi.update.mockReset();
	});

	it('prefills the form from a candidate and creates the space with the local window values', async () => {
		const user = userEvent.setup();
		adminApi.list
			.mockResolvedValueOnce({ items: [], candidates: [CANDIDATE] })
			.mockResolvedValueOnce({ items: [createdSpace()], candidates: [] });
		adminApi.create.mockResolvedValue(createdSpace());

		render(<MemoriesAdmin />);

		await user.click(await screen.findByRole('button', { name: CANDIDATE.eventTitle }));

		expect(
			screen.getByRole('heading', { name: 'Nuevo espacio de recuerdos' }),
		).toBeInTheDocument();
		expect(screen.getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
		expect(screen.getByLabelText('Slug público')).toBeEnabled();
		expect(screen.getByLabelText('Zona horaria')).toHaveValue('America/Mazatlan');
		expect(screen.getByLabelText('Apertura de carga')).toHaveValue('2026-10-30T12:00');
		expect(screen.getByLabelText('Cierre de carga')).toHaveValue('2026-11-01T23:59');
		expect(screen.getByLabelText('Fin de retención')).toHaveValue('2027-01-30T00:00');
		expect(screen.getByLabelText('Origen comercial')).toHaveValue('addon');
		expect(screen.getByLabelText('Videos por invitado')).toHaveValue(5);
		expect(screen.getByLabelText('Habilitado')).toBeChecked();
		expect(
			screen.getByText('URL: https://celebra-me.com/r/victoria-y-roberto'),
		).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Guardar' }));

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
		expect(adminApi.update).not.toHaveBeenCalled();
		expect(
			await screen.findByText(
				'Espacio creado. URL pública: https://celebra-me.com/r/victoria-y-roberto',
			),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { name: 'Nuevo espacio de recuerdos' }),
		).not.toBeInTheDocument();
		expect(adminApi.list).toHaveBeenCalledTimes(2);
	});

	it('lists active spaces with their public URL and window badge, and disables one on request', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({ items: [OPEN_SPACE], candidates: [] });
		adminApi.update.mockResolvedValue({ ...OPEN_SPACE, enabled: false });

		render(<MemoriesAdmin />);

		const row = (await screen.findByText('XV de Sofía')).closest('tr');
		expect(row).not.toBeNull();
		const cells = within(row as HTMLTableRowElement);
		expect(cells.getByText('https://celebra-me.com/r/xv-de-sofia')).toBeInTheDocument();
		expect(cells.getByText('Abierto')).toHaveClass(
			'dashboard-badge',
			'dashboard-badge--active',
		);
		expect(cells.getByText('Incluido en paquete')).toBeInTheDocument();
		expect(
			screen.getByText('No hay eventos publicados pendientes de activar.'),
		).toBeInTheDocument();

		await user.click(cells.getByRole('button', { name: 'Desactivar' }));

		await waitFor(() =>
			expect(adminApi.update).toHaveBeenCalledWith('event-2', { enabled: false }),
		);
		expect(adminApi.create).not.toHaveBeenCalled();
		await waitFor(() => expect(adminApi.list).toHaveBeenCalledTimes(2));
	});

	it('shows the conflict message when creating a space returns 409', async () => {
		const user = userEvent.setup();
		adminApi.list.mockResolvedValue({ items: [], candidates: [CANDIDATE] });
		adminApi.create.mockRejectedValue(new MemoriesRequestError(409, 'conflict'));

		render(<MemoriesAdmin />);

		await user.click(await screen.findByRole('button', { name: CANDIDATE.eventTitle }));
		await user.click(screen.getByRole('button', { name: 'Guardar' }));

		expect(
			await screen.findByText('El evento ya tiene recuerdos o el slug público está en uso.'),
		).toBeInTheDocument();
		expect(adminApi.create).toHaveBeenCalledTimes(1);
		expect(adminApi.list).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole('heading', { name: 'Nuevo espacio de recuerdos' }),
		).toBeInTheDocument();
		expect(screen.getByLabelText('Slug público')).toHaveValue('victoria-y-roberto');
	});
});
