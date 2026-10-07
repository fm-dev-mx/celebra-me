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

const REPORT: PlatformUsageReport = [
	{
		id: 'preview',
		cards: [
			{
				provider: 'cloudflare',
				usage: {
					kind: 'ok',
					fetchedAt: NOW,
					spendUsd: null,
					missing: [
						{
							name: 'MEMORIES_R2_BUCKET_NAME_PREVIEW',
							state: 'absent',
							scope: 'preview',
						},
					],
					metrics: [
						metric('cfR2StorageBucket', 400_000_000, 10_000_000_000, {
							window: 'snapshot',
							scope: 'preview',
							resource: 'celebra-memories-staging',
						}),
					],
				},
			},
			{
				provider: 'supabase',
				usage: {
					kind: 'ok',
					fetchedAt: NOW,
					spendUsd: null,
					missing: [],
					metrics: [
						metric('sbDatabase', 120_000_000, 500_000_000, {
							window: 'snapshot',
							scope: 'preview',
						}),
					],
				},
			},
		],
	},
	{
		id: 'production',
		cards: [
			{
				provider: 'cloudflare',
				usage: {
					kind: 'unconfigured',
					missing: [
						{
							name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
							state: 'absent',
							scope: 'production',
						},
					],
				},
			},
			{ provider: 'supabase', usage: { kind: 'unavailable' } },
		],
	},
	{
		id: 'shared',
		cards: [
			{
				provider: 'cloudflare',
				usage: {
					kind: 'ok',
					fetchedAt: NOW,
					spendUsd: null,
					missing: [],
					metrics: [
						metric('cfR2StorageAccount', 9_500_000_000, 10_000_000_000, {
							window: 'snapshot',
						}),
						metric('cfWorkersRequests', 75_000, 100_000),
						metric('cfR2ClassA', 1_200_000, 1_000_000, {
							window: 'monthUtc',
							overageUsd: 0.9,
							projection: { kind: 'exhaustsAt', at: '2026-10-25T02:00:00.000Z' },
						}),
					],
				},
			},
			{
				provider: 'vercel',
				usage: { kind: 'ok', fetchedAt: NOW, metrics: [], spendUsd: 0, missing: [] },
			},
			{ provider: 'cloudinary', usage: { kind: 'unavailable' } },
		],
	},
];

describe('PlatformUsagePanel island', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders one section per environment plus the shared quotas', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		expect(await screen.findByRole('heading', { name: 'Entorno Preview' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Entorno Producción' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'Compartido por ambos entornos' }),
		).toBeInTheDocument();
	});

	it('renders meters with their level, scope and warnings', async () => {
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
		expect(screen.getAllByText(/el proveedor no respondió/).length).toBe(2);
	});

	it('names the missing variables and links where to generate them', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		expect(await screen.findByText('MEMORIES_R2_BUCKET_NAME_PREVIEW')).toBeInTheDocument();
		expect(screen.getByText(/Bucket R2 de este entorno/)).toBeInTheDocument();
		const bucketLink = screen.getAllByRole('link', {
			name: 'Generar o revisar la credencial',
		})[0];
		expect(bucketLink).toHaveAttribute('href', 'https://dash.cloudflare.com/?to=/:account/r2');

		expect(
			screen.getByText('MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION'),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Token de solo lectura de analítica de Cloudflare/),
		).toBeInTheDocument();
		expect(screen.getByText(/faltan credenciales de solo lectura/)).toBeInTheDocument();
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
