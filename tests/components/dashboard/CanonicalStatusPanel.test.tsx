import { render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import CanonicalStatusPanel from '@/components/dashboard/status/CanonicalStatusPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

jest.mock('@/lib/dashboard/api-client', () => ({ dashboardApi: { get: jest.fn() } }));
const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

describe('CanonicalStatusPanel', () => {
	it('keeps schema, publication, and readiness distinct', () => {
		render(
			<CanonicalStatusPanel initialView={buildCanonicalStatusViewFixture()} />,
		);
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
		expect(screen.getAllByText('La cola de publicación no está verificada.').length).toBeGreaterThan(
			0,
		);
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
		expect(screen.getAllByText(/CURRENT no es evidencia de autorización/).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/No hay un comando canónico para registrar applies históricos/)
				.length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText(/Schema migrations: CURRENT 75\/75/)).toHaveLength(3);
	});
});
