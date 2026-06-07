import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContentSyncPanel from '@/components/dashboard/content-sync/ContentSyncPanel';
import { dashboardApi } from '@/lib/dashboard/api-client';
import type { DemoDriftItem, DemoDriftReport } from '@/lib/content-publication/demo-drift';
import type { DemoPublishDryRunResult } from '@/lib/content-publication/demo-publish';

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: {
		get: jest.fn(),
		post: jest.fn(),
	},
}));

const mockGet = dashboardApi.get as jest.Mock;
const mockPost = dashboardApi.post as jest.Mock;

const emptySummary = {
	in_sync: 0,
	different: 0,
	missing_in_prod: 0,
	missing_locally: 0,
	schema_mismatch: 0,
	unsafe_target: 0,
};

const createItem = (overrides: Partial<DemoDriftItem>): DemoDriftItem => {
	const eventType = overrides.event_type ?? 'wedding';
	const slug = overrides.slug ?? 'demo';

	return {
		event_type: eventType,
		slug,
		route_key: overrides.route_key ?? `${eventType}/${slug}`,
		published_row_id: 'published-demo-id',
		is_demo: true,
		status: 'different',
		local_hash: 'local-hash',
		prod_hash: 'prod-hash',
		changed_paths: ['title'],
		diff_examples: [],
		...overrides,
	};
};

const createReport = (items: DemoDriftItem[]): DemoDriftReport => {
	const summary = { ...emptySummary };
	for (const item of items) summary[item.status] += 1;

	return {
		generated_at: '2026-06-06T00:00:00.000Z',
		scope: 'demos',
		source_environment: 'local',
		target_environment: 'production',
		summary,
		items,
	};
};

const createDryRun = (
	item: DemoDriftItem,
	overrides: Partial<DemoPublishDryRunResult> = {},
): DemoPublishDryRunResult => ({
	can_publish: true,
	event_type: item.event_type,
	slug: item.slug,
	route_key: item.route_key,
	local_hash: item.local_hash ?? 'local-hash',
	prod_hash: item.prod_hash,
	expected_prod_hash: item.prod_hash,
	status: item.status,
	changed_paths: item.changed_paths,
	diff_examples: item.diff_examples,
	warnings: [],
	...overrides,
});

const getRowForDemo = async (routeKey: string) => {
	const cell = await screen.findByText(routeKey);
	const row = cell.closest('tr');
	if (!row) throw new Error(`Could not find row for ${routeKey}`);
	return row;
};

const getPublishButtonForDemo = async (routeKey: string) =>
	within(await getRowForDemo(routeKey)).getByRole('button', {
		name: 'Publicar cambios',
	});

const getDryRunButtonForDemo = async (routeKey: string) =>
	within(await getRowForDemo(routeKey)).getByRole('button', {
		name: 'Ejecutar revisión',
	});

describe('ContentSyncPanel Component', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('shows loading state initially', async () => {
		mockGet.mockReturnValue(new Promise(() => {}));

		render(<ContentSyncPanel />);

		expect(screen.getByText('Cargando demos...')).toBeInTheDocument();
		expect(screen.queryByText('No hay demos para comparar.')).not.toBeInTheDocument();
	});

	it('renders empty state when API succeeds with 0 items', async () => {
		mockGet.mockResolvedValue({
			ok: true,
			data: createReport([]),
		});

		render(<ContentSyncPanel />);

		await waitFor(() => {
			expect(screen.queryByText('Cargando demos...')).not.toBeInTheDocument();
		});

		expect(screen.getByText('No hay demos para comparar.')).toBeInTheDocument();
		expect(
			screen.queryByText(/Error al cargar el estado de publicación/),
		).not.toBeInTheDocument();
	});

	it('keeps publish disabled for blocked unsafe targets', async () => {
		const blocked = createItem({
			status: 'unsafe_target',
			route_key: 'wedding/blocked-demo',
			slug: 'blocked-demo',
			is_demo: false,
		});
		mockGet.mockResolvedValue({ ok: true, data: createReport([blocked]) });

		render(<ContentSyncPanel />);

		expect(await screen.findByText('Bloqueado')).toBeInTheDocument();
		expect(await getPublishButtonForDemo(blocked.route_key)).toBeDisabled();
		expect(await getDryRunButtonForDemo(blocked.route_key)).toBeDisabled();
	});

	it('keeps publish disabled for missing production rows', async () => {
		const missing = createItem({
			status: 'missing_in_prod',
			route_key: 'wedding/missing-demo',
			slug: 'missing-demo',
			published_row_id: null,
			prod_hash: null,
		});
		mockGet.mockResolvedValue({ ok: true, data: createReport([missing]) });

		render(<ContentSyncPanel />);

		expect(await screen.findByText('No publicado')).toBeInTheDocument();
		expect(await getPublishButtonForDemo(missing.route_key)).toBeDisabled();
		expect(await getDryRunButtonForDemo(missing.route_key)).toBeDisabled();
	});

	it('enables publish for different rows only after a matching successful dry-run', async () => {
		const item = createItem({
			route_key: 'wedding/changed-demo',
			slug: 'changed-demo',
			prod_hash: 'current-prod-hash',
		});
		mockGet.mockResolvedValue({ ok: true, data: createReport([item]) });
		mockPost.mockResolvedValue({ ok: true, data: createDryRun(item) });

		render(<ContentSyncPanel />);

		const publishButton = await getPublishButtonForDemo(item.route_key);
		expect(publishButton).toBeDisabled();

		fireEvent.click(await getDryRunButtonForDemo(item.route_key));

		await waitFor(() => {
			expect(publishButton).not.toBeDisabled();
		});
	});

	it('keeps publish disabled when dry-run identity or production hash does not match the row', async () => {
		const item = createItem({
			route_key: 'wedding/stale-demo',
			slug: 'stale-demo',
			prod_hash: 'current-prod-hash',
		});
		mockGet.mockResolvedValue({ ok: true, data: createReport([item]) });
		mockPost.mockResolvedValue({
			ok: true,
			data: createDryRun(item, {
				slug: 'another-demo',
				prod_hash: 'stale-prod-hash',
				expected_prod_hash: 'stale-prod-hash',
			}),
		});

		render(<ContentSyncPanel />);

		fireEvent.click(await getDryRunButtonForDemo(item.route_key));

		await waitFor(() => {
			expect(mockPost).toHaveBeenCalledWith('/api/dashboard/admin/demo-publish/dry-run', {
				event_type: item.event_type,
				slug: item.slug,
			});
		});
		expect(await getPublishButtonForDemo(item.route_key)).toBeDisabled();
	});

	it('keeps publish disabled when dry-run route key does not match the row', async () => {
		const item = createItem({
			route_key: 'wedding/route-demo',
			slug: 'route-demo',
			prod_hash: 'current-prod-hash',
		});
		mockGet.mockResolvedValue({ ok: true, data: createReport([item]) });
		mockPost.mockResolvedValue({
			ok: true,
			data: createDryRun(item, {
				route_key: 'wedding/another-route',
			}),
		});

		render(<ContentSyncPanel />);

		fireEvent.click(await getDryRunButtonForDemo(item.route_key));

		await waitFor(() => {
			expect(mockPost).toHaveBeenCalledWith('/api/dashboard/admin/demo-publish/dry-run', {
				event_type: item.event_type,
				slug: item.slug,
			});
		});
		expect(await getPublishButtonForDemo(item.route_key)).toBeDisabled();
	});

	it('clears dry-run publish access after refreshing the report', async () => {
		const item = createItem({
			route_key: 'wedding/refresh-demo',
			slug: 'refresh-demo',
			prod_hash: 'current-prod-hash',
		});
		mockGet
			.mockResolvedValueOnce({ ok: true, data: createReport([item]) })
			.mockResolvedValueOnce({ ok: true, data: createReport([item]) });
		mockPost.mockResolvedValue({ ok: true, data: createDryRun(item) });

		render(<ContentSyncPanel />);

		const publishButton = await getPublishButtonForDemo(item.route_key);
		fireEvent.click(await getDryRunButtonForDemo(item.route_key));
		await waitFor(() => {
			expect(publishButton).not.toBeDisabled();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

		await waitFor(() => {
			expect(mockGet).toHaveBeenCalledTimes(2);
		});
		expect(await getPublishButtonForDemo(item.route_key)).toBeDisabled();
	});

	it('renders local environment banner as separated readable text', async () => {
		mockGet.mockResolvedValue({ ok: true, data: createReport([]) });

		render(<ContentSyncPanel />);

		await waitFor(() => {
			expect(screen.queryByText('Cargando demos...')).not.toBeInTheDocument();
		});

		const banner = screen.getByLabelText('Entornos de comparación');
		expect(within(banner).getByText('Fuente: local')).toBeInTheDocument();
		expect(within(banner).getByText('Base de datos destino: producción')).toBeInTheDocument();
		expect(
			within(banner).getByText(
				'Estás comparando contenido local contra producción. Publicar desde este entorno modificará datos de producción.',
			),
		).toBeInTheDocument();
	});

	it('shows clear error state and does not show empty state when API fails', async () => {
		mockGet.mockResolvedValue({
			ok: false,
			status: 500,
			code: 'rate_limited',
			message: 'Missing rate-limit configuration for operation: admin:content-drift',
		});

		render(<ContentSyncPanel />);

		await waitFor(() => {
			expect(screen.queryByText('Cargando demos...')).not.toBeInTheDocument();
		});

		expect(
			screen.getByText((content) =>
				content.includes('Error al cargar el estado de publicación.'),
			),
		).toBeInTheDocument();
		expect(
			screen.getByText((content) =>
				content.includes(
					'Missing rate-limit configuration for operation: admin:content-drift',
				),
			),
		).toBeInTheDocument();
		expect(screen.queryByText('No hay demos para comparar.')).not.toBeInTheDocument();
	});
});
