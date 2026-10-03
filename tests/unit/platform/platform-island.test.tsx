jest.mock('@/lib/platform/client/api', () => ({
	platformAdminApi: {
		usage: jest.fn(),
	},
}));

import { render, screen } from '@testing-library/react';
import PlatformUsagePanel from '@/components/dashboard/platform/PlatformUsagePanel';
import { platformAdminApi } from '@/lib/platform/client/api';
import type { PlatformMetric, PlatformUsageReport } from '@/lib/platform/contract/types';

const mockUsage = platformAdminApi.usage as jest.MockedFunction<typeof platformAdminApi.usage>;

const NOW = '2026-10-24T19:00:00.000Z';

function metric(
	id: string,
	used: number | null,
	limit: number | null,
	extra: Partial<PlatformMetric> = {},
): PlatformMetric {
	return {
		id,
		meter: { used, limit },
		window: 'dayUtc',
		scope: 'account',
		overageUsd: null,
		projection: { kind: 'unknown' },
		...extra,
	};
}

const REPORT: PlatformUsageReport = {
	cloudflare: {
		kind: 'ok',
		fetchedAt: NOW,
		spendUsd: null,
		metrics: [
			metric('cfR2StorageAccount', 9_500_000_000, 10_000_000_000, { window: 'snapshot' }),
			metric('cfR2StorageBucket', 400_000_000, 10_000_000_000, {
				window: 'snapshot',
				resource: 'celebra-memories-staging',
			}),
			metric('cfWorkersRequests', 75_000, 100_000),
			metric('cfR2ClassA', 1_200_000, 1_000_000, {
				window: 'monthUtc',
				overageUsd: 0.9,
				projection: { kind: 'exhaustsAt', at: '2026-10-25T02:00:00.000Z' },
			}),
		],
	},
	supabase: { kind: 'unconfigured' },
	vercel: { kind: 'ok', fetchedAt: NOW, metrics: [], spendUsd: 0 },
	cloudinary: { kind: 'unavailable' },
};

describe('PlatformUsagePanel island', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders every provider card with meters, scopes and warnings', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		const total = await screen.findByRole('meter', {
			name: 'Almacenamiento R2 · total de la cuenta',
		});
		expect(total).toHaveAttribute('aria-valuenow', '95');
		expect(total.closest('.usage-meter')).toHaveClass('usage-meter--critical');

		const bucket = screen.getByRole('meter', {
			name: 'Almacenamiento R2 · bucket «celebra-memories-staging»',
		});
		expect(bucket).toHaveAttribute('aria-valuenow', '4');
		expect(bucket.closest('.usage-meter')).toHaveClass('usage-meter--normal');

		expect(
			screen
				.getByRole('meter', { name: 'Peticiones de Workers · total de la cuenta' })
				.closest('.usage-meter'),
		).toHaveClass('usage-meter--warning');

		expect(screen.getAllByText(/de la cuenta, no de un entorno/).length).toBeGreaterThan(0);
		expect(screen.getByText('Excedente estimado: 0.90 USD.')).toBeInTheDocument();
		expect(screen.getByText(/la cuota se agotaría el/)).toBeInTheDocument();
		expect(screen.getByText('Costo del periodo: 0.00 USD.')).toBeInTheDocument();
		expect(screen.getByText(/faltan credenciales de solo lectura/)).toBeInTheDocument();
		expect(screen.getByText(/el proveedor no respondió/)).toBeInTheDocument();
	});

	it('reports a failed console read without breaking the page', async () => {
		mockUsage.mockRejectedValue(new Error('network'));

		render(<PlatformUsagePanel />);

		expect(
			await screen.findByText('No se pudo consultar el consumo de la plataforma.'),
		).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});
});
