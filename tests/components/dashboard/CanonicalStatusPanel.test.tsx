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
		expect(screen.getByText(/AUSENTE/)).toBeInTheDocument();
		expect(
			screen.getByText(/No indica deuda de esquema en Local, Preview o Production/),
		).toBeInTheDocument();
		expect(screen.getByText('Boda de Victoria y Roberto')).toBeInTheDocument();
		expect(screen.getByText('PROMOTE_PRODUCTION')).toBeInTheDocument();
		expect(screen.getByText(/OWNER \/ HITL REQUIRED/)).toBeInTheDocument();
		expect(screen.getByText(/Filas activas en DB \(no son el registro\)/)).toBeInTheDocument();
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
});
