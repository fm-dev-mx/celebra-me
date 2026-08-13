import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import CanonicalStatusPanel from '@/components/dashboard/status/CanonicalStatusPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

jest.mock('@/lib/dashboard/api-client', () => ({ dashboardApi: { get: jest.fn() } }));
const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

describe('CanonicalStatusPanel', () => {
	it('keeps schema, publication, and readiness distinct', () => {
		render(<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />);
		expect(screen.getByRole('heading', { name: 'Estado operacional' })).toBeInTheDocument();
		expect(screen.getAllByText(/Schema migrations: CURRENT 75\/75/)).toHaveLength(3);
		expect(screen.getAllByText('Requiere prueba disposable')).toHaveLength(3);
		expect(screen.getByText('Previa al libro')).toBeInTheDocument();
		expect(screen.getAllByText('No aplica').length).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByText('Requiere corrección').length).toBeGreaterThan(0);
		expect(screen.getByText(/AUSENTE/)).toBeInTheDocument();
		expect(
			screen.getByText(/No indica deuda de esquema en Local, Preview o Production/),
		).toBeInTheDocument();
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();
		expect(screen.getByText('Promover a Production')).toBeInTheDocument();
		expect(screen.getByText(/OWNER \/ HITL REQUIRED/)).toBeInTheDocument();
		expect(screen.getByText(/Filas activas en DB \(no son el registro\)/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Revalidar ahora' })).toBeInTheDocument();
		expect(mockGet).not.toHaveBeenCalled();
	});

	it('does not treat compact connectivity as publication state', () => {
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					promotions: [],
					inSyncCount: 5,
					inSyncSlugs: ['a', 'b', 'c', 'd', 'e'],
				})}
			/>,
		);
		expect(
			screen.getByText('No hay invitaciones del registro que requieran acción.'),
		).toBeInTheDocument();
		expect(screen.queryByText('PROMOTIONS')).not.toBeInTheDocument();
		expect(screen.queryByText('Managed')).not.toBeInTheDocument();
	});

	it('does not treat an unverified empty queue as success', () => {
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
		expect(
			screen.getAllByText('La cola de publicación no está verificada.').length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByText('No hay invitaciones del registro que requieran acción.'),
		).not.toBeInTheDocument();
	});

	it('keeps advanced diagnostics collapsed and without operational authority', () => {
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
		expect(screen.getByText(/Diagnóstico avanzado \(1\)/)).toBeInTheDocument();
		expect(screen.getByText(/Dominio: Publicación · Evidencia: En vivo/)).toBeInTheDocument();
		expect(
			screen.getByText(/No cambian la cola de publicación ni la idoneidad de migración/),
		).toBeInTheDocument();
		expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
		expect(screen.queryByText('ALIGNED')).not.toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Diagnóstico avanzado' })).not.toBeChecked();
	});

	it('surfaces missing Production authorization without treating CURRENT as sufficient', () => {
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
		expect(screen.getByText('Autorización de Production ausente.')).toBeInTheDocument();
		expect(screen.getAllByText(/20260807120000/).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/CURRENT no es evidencia de autorización/).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/No hay un comando canónico para registrar applies históricos/)
				.length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText(/Schema migrations: CURRENT 75\/75/)).toHaveLength(3);
	});

	it('distinguishes cached freshness from stale and migration UNVERIFIED from not applied', () => {
		render(
			<CanonicalStatusPanel
				initialView={buildCanonicalStatusViewFixture({
					freshnessMeta: {
						status: 'CACHED',
						lastVerifiedAt: '2026-08-12T22:11:54.000Z',
					},
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
		expect(screen.queryByText(/Caché duradera/)).not.toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'Migraciones recientes autoritativas' }),
		).toBeInTheDocument();
		expect(screen.getByText(/Aplicada/)).toBeInTheDocument();
		expect(screen.getByText(/No aplicada/)).toBeInTheDocument();
		expect(screen.queryByText(/Sin aplicar \/ No verificada/)).not.toBeInTheDocument();
		expect(screen.getAllByText(/Sonda:/).length).toBeGreaterThan(0);
	});

	it('keeps the last durable view accessible after a recoverable refresh failure and allows retry', async () => {
		const user = userEvent.setup();
		const initial = buildCanonicalStatusViewFixture();
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
			});
		render(<CanonicalStatusPanel initialView={initial} />);

		await user.click(screen.getByRole('button', { name: 'Revalidar ahora' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('La consulta de estado excedió');
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Revalidar ahora' }));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect(mockGet).toHaveBeenCalledTimes(2);
		expect(mockGet.mock.calls[0]?.[0]).toContain('refresh=1');
	});

	it('prevents a duplicate click while an identical refresh is pending and exposes labelled controls', async () => {
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
		expect(screen.getByText(/Evidencia En vivo/)).toHaveAttribute('aria-live', 'polite');

		const refresh = screen.getByRole('button', { name: 'Revalidar ahora' });
		const requestsBeforeRefresh = mockGet.mock.calls.length;
		await user.click(refresh);
		expect(refresh).toBeDisabled();
		await user.click(refresh);
		expect(mockGet).toHaveBeenCalledTimes(requestsBeforeRefresh + 1);
		resolveRefresh?.({
			ok: true,
			status: 200,
			data: buildCanonicalStatusViewFixture(),
		} as never);
		await waitFor(() => expect(refresh).not.toBeDisabled());
	});
});
