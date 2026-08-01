import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import ObservabilityPanel from '@/components/dashboard/observability/ObservabilityPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { ObservabilitySnapshot } from '@/lib/observability/types';

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn() },
}));

const mockGet = dashboardApi.get as jest.MockedFunction<typeof dashboardApi.get>;

function payload(): ObservabilitySnapshot {
	return {
		schemaVersion: 2,
		generatedAt: '2026-08-01T12:00:00.000Z',
		overallStatus: 'ATTENTION',
		cache: { state: 'fresh', refreshAfter: '2099-08-01T12:01:00.000Z' },
		source: { branch: 'dev-local', commitShaShort: 'abcdef1234', workingTreeDirty: false },
		health: {
			environments: { total: 3, ok: 2, warning: 0, blocking: 0, unverified: 1 },
			invitations: { total: 13, ok: 12, warning: 1, blocking: 0, unverified: 0 },
			migrations: { total: 3, ok: 3, warning: 0, blocking: 0, unverified: 0 },
			assets: { total: 13, ok: 13, warning: 0, blocking: 0, unverified: 0 },
			validations: { total: 2, ok: 2, warning: 0, blocking: 0, unverified: 0 },
		},
		issues: [
			{
				id: 'invitation_behind:sample',
				code: 'INVITATION_BEHIND',
				severity: 'warning',
				domain: 'invitation',
				scope: 'sample',
				slug: 'sample',
				title: 'La invitación está detrás de la fuente canónica',
				description: 'Revise la comparación antes de publicar.',
				actionIds: ['inspect:sample'],
			},
		],
		validationEvidence: [
			{
				type: 'regression',
				freshness: 'PASS',
				completedAt: '2026-08-01T12:00:00.000Z',
				passed: 13,
				total: 13,
			},
			{
				type: 'screenshots',
				freshness: 'PASS',
				completedAt: '2026-08-01T12:00:00.000Z',
				passed: 13,
				total: 13,
			},
		],
		recommendedActions: [
			{
				id: 'inspect:sample',
				label: 'Inspeccionar invitación',
				command: 'pnpm dbs --compact sample',
				reason: 'Diagnóstico de sólo lectura.',
			},
		],
	};
}

describe('ObservabilityPanel', () => {
	it('renders anomalies before compact healthy coverage', async () => {
		mockGet.mockResolvedValue({ ok: true, status: 200, data: payload() });
		render(<ObservabilityPanel />);
		expect(screen.getByRole('status')).toHaveTextContent('Comprobando señales operacionales');
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Atención requerida' })).toBeInTheDocument(),
		);
		expect(
			screen.getByText('La invitación está detrás de la fuente canónica'),
		).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Actualización disponible en breve' }),
		).toBeDisabled();
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
