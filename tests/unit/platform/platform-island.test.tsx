jest.mock('@/lib/platform/client/api', () => ({
	platformAdminApi: {
		usage: jest.fn(),
	},
}));

import { render, screen, within } from '@testing-library/react';
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

/** Local panel: both environments plus the shared quotas. */
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
							name: 'MEMORIES_R2_BUCKET_NAME',
							state: 'absent',
							scope: 'preview',
						},
					],
					metrics: [
						metric('cfR2StorageBucket', null, 10_000_000_000, {
							window: 'snapshot',
							scope: 'preview',
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
						metric('sbDisk', 120_000_000, null, {
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
							name: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
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
					spendUsd: 0,
					missing: [],
					metrics: [
						metric('cfR2StorageAccount', 9_500_000_000, 10_000_000_000, {
							window: 'snapshot',
						}),
						metric('cfWorkersRequests', 7_500_000, 10_000_000, { window: 'monthUtc' }),
						metric('cfR2ClassA', 1_200_000, 1_000_000, {
							window: 'monthUtc',
							overageUsd: 0.9,
							projection: { kind: 'exhaustsAt', at: '2026-10-25T02:00:00.000Z' },
						}),
						metric('cfDurableObjectsRequests', 1_900, 1_000_000, {
							window: 'monthUtc',
						}),
					],
				},
			},
		],
	},
];

/** Production deployment: only Production plus the shared quotas, all healthy. */
const HEALTHY_PRODUCTION: PlatformUsageReport = [
	{
		id: 'production',
		cards: [
			{
				provider: 'cloudflare',
				usage: {
					kind: 'ok',
					fetchedAt: NOW,
					spendUsd: null,
					missing: [
						{ name: 'MEMORIES_R2_BUCKET_NAME', state: 'absent', scope: 'production' },
					],
					metrics: [
						metric('cfR2StorageBucket', null, 10_000_000_000, {
							window: 'snapshot',
							scope: 'production',
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
						metric('sbDisk', 333_000_000, null, {
							window: 'snapshot',
							scope: 'production',
						}),
					],
				},
			},
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
						metric('cfWorkersRequests', 10_000, 10_000_000, { window: 'monthUtc' }),
					],
				},
			},
		],
	},
];

describe('PlatformUsagePanel island', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('leads with the overall status and the last update', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		const summary = await screen.findByRole('region', { name: 'Hay cuotas críticas' });
		expect(within(summary).getByText('2 críticas (≥ 90 %)')).toBeInTheDocument();
		expect(within(summary).getByText('1 en aviso (≥ 70 %)')).toBeInTheDocument();
		expect(within(summary).getByText('2 datos por configurar')).toBeInTheDocument();
		expect(within(summary).getByText('1 proveedor sin respuesta')).toBeInTheDocument();
		expect(
			within(summary).getByText(/^Actualizado .* \(hora de Mazatlán\)$/),
		).toBeInTheDocument();
	});

	it('groups quotas by provider, shared first, then each environment', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		const cloudflare = await screen.findByRole('region', { name: 'Cloudflare' });
		expect(within(cloudflare).getByText(/Workers Paid y R2 Paid/)).toBeInTheDocument();
		expect(within(cloudflare).queryByText(/plan gratuito/)).not.toBeInTheDocument();
		expect(
			within(cloudflare).getByRole('region', { name: 'Cloudflare · Toda la cuenta' }),
		).toBeInTheDocument();
		expect(
			within(cloudflare).getByRole('region', { name: 'Cloudflare · Producción' }),
		).toBeInTheDocument();
		expect(
			within(cloudflare).getByRole('region', { name: 'Cloudflare · Preview' }),
		).toBeInTheDocument();

		const supabase = screen.getByRole('region', { name: 'Supabase' });
		expect(within(supabase).getByText(/la base pasa a solo lectura/)).toBeInTheDocument();
		expect(within(supabase).getByText('Disco (incluye WAL)')).toBeInTheDocument();
		expect(within(supabase).getByText('120 MB')).toBeInTheDocument();
		expect(within(supabase).getAllByText(/Solo informativo, sin alertas/)).toHaveLength(1);
		// Disk is informative: no meter, no threshold against the 500 MB database cap.
		expect(within(supabase).queryByRole('meter')).not.toBeInTheDocument();
		expect(within(supabase).queryByText(/Sin cuota verificada/)).not.toBeInTheDocument();
		expect(within(supabase).getByText(/El proveedor no respondió/)).toBeInTheDocument();
	});

	it('colors meters by threshold and prints short numbers', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		const storage = await screen.findByRole('meter', {
			name: 'Almacenamiento R2 (todos los buckets)',
		});
		expect(storage).toHaveAttribute('aria-valuenow', '95');
		expect(storage.closest('.usage-meter')).toHaveClass('usage-meter--critical');
		expect(
			within(storage.closest('li') as HTMLElement).getByText('Crítico'),
		).toBeInTheDocument();

		const workers = screen.getByRole('meter', { name: 'Peticiones a Workers' });
		expect(workers.closest('.usage-meter')).toHaveClass('usage-meter--warning');
		expect(workers).toHaveAttribute('aria-valuetext', '7.5 M de 10 M (75 %)');

		const durableObjects = screen.getByRole('meter', { name: 'Peticiones a Durable Objects' });
		expect(durableObjects.closest('.usage-meter')).toHaveClass('usage-meter--normal');
		expect(durableObjects).toHaveAttribute('aria-valuetext', '1.9k de 1 M (<1 %)');

		expect(screen.getByText('Excedente estimado: 0.90 USD.')).toBeInTheDocument();
		expect(screen.getByText(/se agotaría el/)).toBeInTheDocument();
		expect(screen.getByText('Costo del periodo: 0.00 USD.')).toBeInTheDocument();
	});

	it('turns missing configuration into an actionable notice, not «Sin datos»', async () => {
		mockUsage.mockResolvedValue(REPORT);

		render(<PlatformUsagePanel />);

		const preview = await screen.findByRole('region', { name: 'Cloudflare · Preview' });
		expect(within(preview).getByText('MEMORIES_R2_BUCKET_NAME')).toBeInTheDocument();
		expect(within(preview).getByText(/^Falta configurar:/)).toBeInTheDocument();
		expect(within(preview).getByText(/\.env\.local/)).toBeInTheDocument();
		expect(within(preview).queryByText('Sin datos')).not.toBeInTheDocument();
		expect(
			within(preview).getByText(/Pendiente: completa la configuración/),
		).toBeInTheDocument();
		expect(within(preview).getByRole('link', { name: /Ver los buckets R2/ })).toHaveAttribute(
			'href',
			'https://dash.cloudflare.com/?to=/:account/r2',
		);

		const production = screen.getByRole('region', { name: 'Cloudflare · Producción' });
		expect(
			within(production).getByText('MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN'),
		).toBeInTheDocument();
		expect(
			within(production).getByText(/Token de solo lectura de analítica de Cloudflare/),
		).toBeInTheDocument();
		expect(
			within(production).getByRole('link', { name: /Generar o revisar la credencial/ }),
		).toHaveAttribute('href', expect.stringContaining('/:account/api-tokens'));
	});

	it('names the Worker secret and command on a deployment', async () => {
		mockUsage.mockResolvedValue(HEALTHY_PRODUCTION);

		render(<PlatformUsagePanel />);

		expect(
			await screen.findByRole('region', { name: 'Faltan datos por leer' }),
		).toBeInTheDocument();
		const production = screen.getByRole('region', { name: 'Cloudflare · Producción' });
		expect(within(production).getByText(/secreto del Worker «celebra-me»/)).toBeInTheDocument();
		expect(
			within(production).getByText('pnpm ops:cloudflare:production:secrets'),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('region', { name: 'Cloudflare · Preview' }),
		).not.toBeInTheDocument();
		// 333 MB of disk is not a 70 % alarm: only the R2 gap is pending.
		expect(screen.getByText('333 MB')).toBeInTheDocument();
		expect(screen.queryByText(/en aviso/)).not.toBeInTheDocument();
		expect(screen.getByText('1 dato por configurar')).toBeInTheDocument();
	});

	it('reports a failed console read without breaking the page', async () => {
		mockUsage.mockRejectedValue(new Error('network'));

		render(<PlatformUsagePanel />);

		expect(
			await screen.findByText(/No se pudo consultar el consumo de la plataforma/),
		).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});
});
