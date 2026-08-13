import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import CanonicalStatusPanel from '@/components/dashboard/status/CanonicalStatusPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

jest.mock('@/lib/dashboard/api-client', () => ({ dashboardApi: { get: jest.fn() } }));
const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

describe('CanonicalStatusPanel', () => {
	beforeEach(() => {
		mockGet.mockReset();
	});

	it('prioriza salud global, acciones visibles y una sola jerarquía H2 del panel', () => {
		render(<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />);
		expect(
			screen.getByRole('heading', { level: 2, name: 'Estado operacional' }),
		).toBeInTheDocument();
		expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
		expect(screen.getByText('Acciones necesarias')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Qué hacer ahora' })).toBeInTheDocument();
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();
		expect(screen.getAllByText(/prod:apply/).length).toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: 'Copiar' }).length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: 'Revalidar todo' })).toBeInTheDocument();
	});

	it('mantiene No aplica neutral y separa publicación sin acción', () => {
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					promotions: [],
					inSyncCount: 5,
					inSyncSlugs: ['a', 'b', 'c', 'd', 'e'],
				})}
			/>,
		);
		expect(screen.getByText(/No hay invitaciones que requieran promoción/)).toBeInTheDocument();
		expect(screen.getAllByText('No aplica').length).toBeGreaterThanOrEqual(2);
		expect(screen.queryByText('PROMOTIONS')).not.toBeInTheDocument();
	});

	it('no convierte una cola vacía sin evidencia en verde', () => {
		const base = buildCanonicalStatusViewFixture();
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					promotions: [],
					inSyncCount: 0,
					inSyncSlugs: [],
					environments: {
						local: { ...base.environments.local, evidence: 'UNVERIFIED' },
						preview: { ...base.environments.preview, evidence: 'UNVERIFIED' },
						production: { ...base.environments.production, evidence: 'UNVERIFIED' },
					},
				})}
			/>,
		);
		expect(screen.getByText('Acciones necesarias')).toBeInTheDocument();
		expect(screen.getAllByText(/Revalidar evidencia/).length).toBeGreaterThan(0);
		expect(screen.queryByText('Todo en orden')).not.toBeInTheDocument();
	});

	it('deja detalles avanzados colapsados y sin autoridad operativa', () => {
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					diagnostics: [
						{
							code: 'MANAGED_DRIFT',
							domain: 'content',
							evidence: 'LIVE',
							slug: 'victoria-y-roberto',
							environment: 'preview',
							cause: 'Live managed content differs from the canonical definition.',
							affectedFieldCount: 2,
							affectedSectionCount: 1,
							semanticPaths: ['hero.title'],
						},
					],
				})}
			/>,
		);
		const summary = screen.getByText('Diagnóstico avanzado (1)');
		expect(summary.closest('details')).not.toHaveAttribute('open');
		expect(
			screen.getByText('Live managed content differs from the canonical definition.'),
		).toBeInTheDocument();
		expect(screen.getByText(/Esta vista es read-only/)).toBeInTheDocument();
	});

	it('muestra autorización Owner ausente como bloqueo sin inventar comando', () => {
		const base = buildCanonicalStatusViewFixture();
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					environments: {
						...base.environments,
						production: {
							...base.environments.production,
							authorizationIntegrity: 'MISSING',
							authorizationMissingVersions: ['20260807120000'],
						},
					},
				})}
			/>,
		);
		expect(screen.getByText(/Autorización · Producción/)).toBeInTheDocument();
		expect(
			screen.getAllByText(/No se pueden registrar applies históricos/).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText('Revisión Owner').length).toBeGreaterThan(0);
	});

	it('distingue caché de evidencia live y conserva historial colapsado', () => {
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					freshnessMeta: { status: 'CACHED', lastVerifiedAt: '2026-08-12T22:11:54.000Z' },
					recentMigrations: [
						{
							version: '20260806120000',
							name: 'base.sql',
							presence: {
								local: 'APPLIED',
								preview: 'UNVERIFIED',
								production: 'NOT_APPLIED',
							},
							verifiedAt: {
								local: '2026-08-12T22:11:54.000Z',
								preview: null,
								production: '2026-08-12T22:11:54.000Z',
							},
						},
					],
				})}
			/>,
		);
		expect(screen.getByText(/En caché \(verificado/)).toBeInTheDocument();
		expect(screen.getByText(/Historial de migraciones recientes/)).toBeInTheDocument();
		expect(
			screen.getByText(/Historial de migraciones recientes/).closest('details'),
		).not.toHaveAttribute('open');
	});

	it('conserva la vista durable ante fallo de refresh y permite reintentar', async () => {
		const user = userEvent.setup();
		mockGet
			.mockResolvedValueOnce({
				ok: false,
				status: 504,
				code: 'service_unavailable',
				message: 'La consulta de estado excedió el tiempo límite.',
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				data: buildCanonicalStatusViewFixture({ evidence: 'CACHED' }),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				data: buildCanonicalStatusViewFixture({ evidence: 'LIVE' }),
			});
		render(<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />);
		await user.click(screen.getByRole('button', { name: 'Revalidar todo' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('La consulta de estado excedió');
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Revalidar todo' }));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect(mockGet).toHaveBeenCalledTimes(3);
		expect(mockGet).toHaveBeenNthCalledWith(2, '/api/dashboard/estado?refresh=1', {
			timeoutMs: 130_000,
		});
		expect(mockGet).toHaveBeenNthCalledWith(3, '/api/dashboard/estado?refresh=1&preflight=1', {
			timeoutMs: 130_000,
		});
	});

	it('conserva la oleada rápida si el preflight de Production agota el tiempo', async () => {
		const user = userEvent.setup();
		mockGet
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				data: buildCanonicalStatusViewFixture({ evidence: 'LIVE' }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 504,
				code: 'service_unavailable',
				message: 'La consulta de estado excedió el tiempo límite.',
			});
		render(<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />);
		await user.click(screen.getByRole('button', { name: 'Revalidar todo' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('La consulta de estado excedió');
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();
		expect(mockGet).toHaveBeenCalledTimes(2);
	});

	it('evita doble refresh y mantiene controles etiquetados dentro del alcance', async () => {
		const user = userEvent.setup();
		let resolveRefresh: ((value: never) => void) | undefined;
		mockGet.mockImplementationOnce(
			() =>
				new Promise<never>((resolve) => {
					resolveRefresh = resolve;
				}),
		);
		render(<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />);
		expect(screen.getByLabelText('Entorno')).toBeInTheDocument();
		expect(screen.getByLabelText('Dominio')).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Diagnóstico avanzado' })).toBeInTheDocument();
		const refresh = screen.getByRole('button', { name: 'Revalidar todo' });
		await user.click(refresh);
		expect(refresh).toBeDisabled();
		await user.click(refresh);
		expect(mockGet).toHaveBeenCalledTimes(1);
		expect(mockGet).toHaveBeenCalledWith('/api/dashboard/estado?refresh=1', {
			timeoutMs: 130_000,
		});
		mockGet.mockResolvedValueOnce({
			ok: true,
			status: 200,
			data: buildCanonicalStatusViewFixture(),
		});
		resolveRefresh?.({
			ok: true,
			status: 200,
			data: buildCanonicalStatusViewFixture(),
		} as never);
		await waitFor(() => expect(refresh).not.toBeDisabled());
		expect(mockGet).toHaveBeenCalledWith('/api/dashboard/estado?refresh=1&preflight=1', {
			timeoutMs: 130_000,
		});
	});
});
