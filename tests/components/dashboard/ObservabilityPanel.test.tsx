import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import ObservabilityPanel from '@/components/dashboard/observability/ObservabilityPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { buildObservabilitySnapshotFixture } from '../../helpers/observability-snapshot-fixture';

jest.mock('@/lib/dashboard/api-client', () => ({ dashboardApi: { get: jest.fn() } }));
const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

function payload() {
	return buildObservabilitySnapshotFixture({
		deliveryStatus: 'IN_PROGRESS',
		cache: { refreshAfter: '2099-08-01T12:01:00.000Z' },
		workItems: [
			{
				impact: 'DELIVERY',
				reasonCode: 'CANONICAL_CHANGE_PENDING',
				nextStep: 'PROMOTE_PREVIEW',
				operationalStatus: 'HEALTHY',
				deliveryStatus: 'IN_PROGRESS',
				detailStatus: 'AVAILABLE',
				affectedFieldCount: 1,
				affectedSectionCount: 1,
				semanticPaths: ['hero.title'],
				environment: 'preview',
				slug: 'sample',
				lifecycle: 'published',
				comparisonOutcome: 'APPLY',
			},
		],
		environmentSummaries: ['local', 'preview', 'production'].map((environment) => ({
			environment: environment as 'local' | 'preview' | 'production',
			operationalStatus: 'HEALTHY' as const,
			deliveryStatus:
				environment === 'local' ? ('ALIGNED' as const) : ('IN_PROGRESS' as const),
			coverage: 'AVAILABLE' as const,
			counts: { invitations: 1, issues: 0, workItems: environment === 'preview' ? 1 : 0 },
		})),
		invitationSummaries: [
			{
				slug: 'sample',
				lifecycle: 'published',
				operationalStatus: 'HEALTHY',
				deliveryStatus: 'IN_PROGRESS',
				comparisons: [],
			},
		],
	});
}

describe('ObservabilityPanel', () => {
	it('renders operational health separately from delivery work', async () => {
		mockGet.mockResolvedValue({ ok: true, status: 200, data: payload() } as never);
		render(<ObservabilityPanel />);
		expect(screen.getByRole('status')).toHaveTextContent('Comprobando señales operacionales');
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Trabajo de entrega' })).toBeInTheDocument(),
		);
		expect(screen.getByText('Salud: Saludable')).toBeInTheDocument();
		expect(screen.getByText('Entrega: En progreso')).toBeInTheDocument();
		expect(screen.getByText('Hay un cambio canónico pendiente')).toBeInTheDocument();
		expect(screen.getByText('No hay incidencias confirmadas.')).toBeInTheDocument();
		expect(mockGet).toHaveBeenCalledWith(
			'/api/dashboard/observabilidad?mode=detail',
			expect.objectContaining({ timeoutMs: 30_000 }),
		);
	});

	it('shows a recoverable alert when the first request fails', async () => {
		mockGet.mockResolvedValue({
			ok: false,
			status: 504,
			code: 'service_unavailable',
			message: 'Tiempo de espera agotado.',
		});
		render(<ObservabilityPanel />);
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Tiempo de espera agotado.'),
		);
	});
});
