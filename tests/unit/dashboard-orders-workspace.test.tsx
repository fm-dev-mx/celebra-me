import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import OrdersWorkspace from '@/components/dashboard/orders/OrdersWorkspace';
import { dashboardApi } from '@/lib/dashboard/api-client';
import { getActiveCampaign, getPackagePrice } from '@/data/promo-campaign.data';

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/components/dashboard/commercial/InvitationDataPanel', () => ({
	__esModule: true,
	default: ({ orderId }: { orderId: string }) => <div>Datos de su invitación: {orderId}</div>,
}));
const customer = { id: 'customer-1', displayName: 'Cliente de prueba', phoneE164: '+526681234567' };
const order = {
	id: 'order-1',
	orderNumber: 'CMO-TEST',
	customerId: customer.id,
	eventType: 'xv',
	currency: 'MXN',
	totalAmount: 1000,
	amountPaid: 0,
	status: 'quoted',
};
const ok = (data: unknown) => ({ ok: true as const, status: 200, data: { data } });
const post = jest.mocked(dashboardApi.post);
const get = jest.mocked(dashboardApi.get);

beforeEach(() => {
	jest.clearAllMocks();
	get.mockResolvedValue(ok({ items: [], nextOffset: null }));
	post.mockImplementation(async (path) =>
		ok(
			path.endsWith('/customers')
				? { outcome: 'created', customer }
				: path.endsWith('/orders')
					? order
					: { order: { ...order, amountPaid: 1000, status: 'paid' } },
		),
	);
});
async function reachOrder() {
	fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: customer.displayName } });
	fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '6681234567' } });
	fireEvent.click(screen.getByText('Crear cliente y continuar'));
	await screen.findByText('Paso 2: Pedido');
	expect(screen.getByLabelText('Total (MXN)')).toHaveValue(
		getPackagePrice('esencial', getActiveCampaign()),
	);
}
async function reachPayment() {
	await reachOrder();
	fireEvent.click(screen.getByText('Crear pedido y continuar'));
	await screen.findByText('Paso 3: Pago por transferencia');
}
test.each([1000, 250])(
	'creates customer, quoted order and first payment of %s without a suggested fraction',
	async (amount) => {
		render(<OrdersWorkspace />);
		await reachPayment();
		expect(screen.getByLabelText('Monto recibido (MXN)')).toHaveValue(1000);
		fireEvent.change(screen.getByLabelText('Monto recibido (MXN)'), {
			target: { value: String(amount) },
		});
		fireEvent.click(screen.getByText('Guardar pago por transferencia'));
		await screen.findByText('Pago registrado');
		expect(post).toHaveBeenLastCalledWith(
			expect.stringContaining('/order-1/deposit-paid'),
			expect.objectContaining({
				amountPaid: amount,
				paidAt: expect.any(String),
				idempotencyKey: expect.any(String),
			}),
		);
		expect(post.mock.calls[1][1]).not.toHaveProperty('depositAmount');
		expect(screen.queryByText(/anticipo|50 %/i)).not.toBeInTheDocument();
	},
);
test.each(['server', 'network'])(
	'retries an uncertain %s payment with the exact request and no second order',
	async (failure) => {
		render(<OrdersWorkspace />);
		await reachPayment();
		if (failure === 'network') post.mockRejectedValueOnce(new TypeError('Error de conexión'));
		else
			post.mockResolvedValueOnce({
				ok: false,
				status: 503,
				code: 'service_unavailable',
				message: 'Servicio temporalmente no disponible',
			});
		fireEvent.click(screen.getByText('Guardar pago por transferencia'));
		await screen.findByRole('alert');
		const first = post.mock.calls.at(-1);
		expect(screen.getByLabelText('Monto recibido (MXN)')).toBeDisabled();
		fireEvent.click(screen.getByText('Guardar pago por transferencia'));
		await screen.findByText('Pago registrado');
		expect(post.mock.calls.at(-1)).toEqual(first);
		expect(post.mock.calls.filter(([path]) => path.endsWith('/orders'))).toHaveLength(1);
	},
);
test('searches a standalone customer and changes the server-side list filter', async () => {
	get.mockImplementation(async (path) =>
		ok(
			path.includes('/customers?')
				? [customer]
				: path.includes('/reconciliation?')
					? { byPhone: [], byEmail: [] }
					: { items: [], nextOffset: null },
		),
	);
	render(<OrdersWorkspace />);
	fireEvent.change(screen.getByLabelText('Teléfono, correo o código CM-'), {
		target: { value: '6681234567' },
	});
	fireEvent.click(screen.getByText('Buscar cliente'));
	fireEvent.click(await screen.findByText(/Cliente de prueba ·/));
	await screen.findByText('Paso 2: Pedido');
	fireEvent.change(screen.getByLabelText('Estado del pedido'), { target: { value: 'partial' } });
	await waitFor(() =>
		expect(get).toHaveBeenCalledWith(expect.stringContaining('status=partial')),
	);
});

test('loads the authoritative customer for a CM code and preserves lead attribution', async () => {
	get.mockImplementation(async (path) =>
		ok(
			path.includes('/reconciliation?')
				? {
						byLeadCode: {
							id: 'lead-1',
							leadCode: 'CM-TEST',
							name: 'Prospecto',
							customerId: customer.id,
						},
					}
				: path.includes('/customers?')
					? customer
					: { items: [], nextOffset: null },
		),
	);
	render(<OrdersWorkspace />);
	fireEvent.change(screen.getByLabelText('Teléfono, correo o código CM-'), {
		target: { value: 'CM-TEST' },
	});
	fireEvent.click(screen.getByText('Buscar cliente'));
	fireEvent.click(await screen.findByText(/CM-TEST · Prospecto/));
	await screen.findByText('Paso 2: Pedido');
	expect(screen.getByText(`Cliente: ${customer.displayName}`)).toBeInTheDocument();
	fireEvent.click(screen.getByText('Crear pedido y continuar'));
	await screen.findByText('Paso 3: Pago por transferencia');
	expect(post).toHaveBeenCalledWith(
		expect.stringContaining('/orders'),
		expect.objectContaining({ customerId: customer.id, leadId: 'lead-1' }),
	);
});

test.each(['server', 'network'])(
	'retries %s order creation without changing its identity or payload',
	async (failure) => {
		render(<OrdersWorkspace />);
		await reachOrder();
		if (failure === 'network') post.mockRejectedValueOnce(new TypeError('Error de conexión'));
		else
			post.mockResolvedValueOnce({
				ok: false,
				status: 503,
				code: 'service_unavailable',
				message: 'Intente de nuevo.',
			});
		fireEvent.click(screen.getByText('Crear pedido y continuar'));
		await screen.findByRole('alert');
		const first = post.mock.calls.at(-1);
		expect(screen.getByLabelText('Total (MXN)')).toBeDisabled();
		expect(screen.getByText('Volver')).toBeDisabled();
		fireEvent.click(screen.getByText('Crear pedido y continuar'));
		await screen.findByText('Paso 3: Pago por transferencia');
		expect(post.mock.calls.at(-1)).toEqual(first);
	},
);

test.each([400, 409, 422])(
	'allows correcting a rejected %s order without replacing its retry key',
	async (status) => {
		render(<OrdersWorkspace />);
		await reachOrder();
		post.mockResolvedValueOnce({
			ok: false,
			status,
			code: 'validation_error',
			message: 'Revise los datos del pedido.',
		});
		fireEvent.click(screen.getByText('Crear pedido y continuar'));
		await screen.findByRole('alert');
		const first = post.mock.calls.at(-1)?.[1] as Record<string, unknown>;
		expect(screen.getByLabelText('Total (MXN)')).toBeEnabled();
		expect(screen.getByLabelText('Paquete')).toBeEnabled();
		expect(screen.getByText('Volver')).toBeEnabled();
		fireEvent.change(screen.getByLabelText('Paquete'), { target: { value: 'signature' } });
		fireEvent.change(screen.getByLabelText('Total (MXN)'), { target: { value: '1250' } });
		fireEvent.click(screen.getByText('Crear pedido y continuar'));
		await screen.findByText('Paso 3: Pago por transferencia');
		expect(post.mock.calls.at(-1)?.[1]).toEqual({
			...first,
			packageId: 'signature',
			packageName: 'Signature',
			totalAmount: 1250,
		});
	},
);

test.each([400, 409, 422])(
	'allows correcting a rejected %s payment without creating another order',
	async (status) => {
		render(<OrdersWorkspace />);
		await reachPayment();
		post.mockResolvedValueOnce({
			ok: false,
			status,
			code: 'validation_error',
			message: 'Revise el pago.',
		});
		fireEvent.click(screen.getByText('Guardar pago por transferencia'));
		await screen.findByRole('alert');
		const first = post.mock.calls.at(-1)?.[1] as Record<string, unknown>;
		expect(screen.getByLabelText('Monto recibido (MXN)')).toBeEnabled();
		expect(screen.getByLabelText('Fecha del pago')).toBeEnabled();
		fireEvent.change(screen.getByLabelText('Monto recibido (MXN)'), {
			target: { value: '250' },
		});
		fireEvent.change(screen.getByLabelText('Fecha del pago'), {
			target: { value: '2026-01-01' },
		});
		fireEvent.click(screen.getByText('Guardar pago por transferencia'));
		await screen.findByText('Pago registrado');
		expect(post.mock.calls.at(-1)?.[1]).toEqual({
			...first,
			amountPaid: 250,
			paidAt: '2026-01-01T19:00:00.000Z',
		});
		expect(post.mock.calls.filter(([path]) => path.endsWith('/orders'))).toHaveLength(1);
	},
);

test('preserves focus through mount and initial reads, then focuses a user-triggered step', async () => {
	render(<button type="button">Menú del panel</button>);
	const menu = screen.getByText('Menú del panel');
	menu.focus();
	render(
		<StrictMode>
			<OrdersWorkspace />
		</StrictMode>,
	);
	expect(menu).toHaveFocus();
	await screen.findByText('No hay pedidos para este filtro.');
	expect(menu).toHaveFocus();
	await reachOrder();
	expect(screen.getByRole('heading', { name: 'Paso 2: Pedido' })).toHaveFocus();
});
