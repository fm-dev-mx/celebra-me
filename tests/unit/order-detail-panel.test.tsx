import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrderDetailPanel from '@/components/dashboard/orders/OrderDetailPanel';
import { deriveOrderStages } from '@/lib/commercial/order-stages';
import { dashboardApi } from '@/lib/dashboard/api-client';

jest.mock('@/lib/dashboard/api-client', () => ({
	dashboardApi: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const get = jest.mocked(dashboardApi.get);
const post = jest.mocked(dashboardApi.post);
const patch = jest.mocked(dashboardApi.patch);

function detail(overrides: Record<string, unknown> = {}, payments: unknown[] = []) {
	const order = {
		id: 'order-1',
		status: 'deposit_paid',
		totalAmount: 1000,
		amountPaid: 400,
		eventDate: '2027-03-20',
		...overrides,
	};
	return {
		ok: true as const,
		status: 200,
		data: {
			data: {
				order,
				payments,
				stages: deriveOrderStages({
					status: order.status as never,
					amountPaid: order.amountPaid as number,
				}),
			},
		},
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(globalThis, 'crypto', {
		value: { randomUUID: () => 'attempt-key' },
		configurable: true,
	});
});

describe('OrderDetailPanel', () => {
	it('shows the seven stages, the current one announced, the event date and the balance', async () => {
		get.mockResolvedValue(
			detail({}, [
				{ id: 'p1', kind: 'deposit', amount: 400, paidAt: '2026-11-01T18:00:00.000Z' },
			]) as never,
		);
		render(<OrderDetailPanel orderId="order-1" />);
		const line = await screen.findByRole('list', { name: 'Etapas del pedido' });
		expect(line.querySelectorAll('li')).toHaveLength(7);
		expect(line.querySelector('[aria-current="step"]')).toHaveTextContent('Anticipo');
		expect(screen.getByLabelText('Fecha del evento')).toHaveValue('2027-03-20');
		expect(screen.getByText(/Anticipo · \$400\.00/)).toBeInTheDocument();
		expect(screen.getByText(/Saldo pendiente: \$600\.00/)).toBeInTheDocument();
	});

	it('records an installment with a stable key and refreshes the order', async () => {
		get.mockResolvedValue(detail() as never);
		post.mockResolvedValue({ ok: true, status: 200, data: {} } as never);
		const onChanged = jest.fn();
		render(<OrderDetailPanel orderId="order-1" onChanged={onChanged} />);
		const amount = await screen.findByLabelText('Monto recibido (MXN)');
		fireEvent.change(amount, { target: { value: '200' } });
		fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }));
		await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
		expect(post).toHaveBeenCalledWith(
			'/api/dashboard/commercial/orders/order-1/payments',
			expect.objectContaining({ amount: 200, idempotencyKey: 'attempt-key' }),
		);
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('offers the settlement when the amount covers the balance', async () => {
		get.mockResolvedValue(detail() as never);
		render(<OrderDetailPanel orderId="order-1" />);
		await screen.findByLabelText('Monto recibido (MXN)');
		expect(screen.getByRole('button', { name: 'Registrar liquidación' })).toBeInTheDocument();
	});

	it('refuses a payment above the balance without calling the API', async () => {
		get.mockResolvedValue(detail() as never);
		render(<OrderDetailPanel orderId="order-1" />);
		const amount = await screen.findByLabelText('Monto recibido (MXN)');
		fireEvent.change(amount, { target: { value: '900' } });
		fireEvent.submit(amount.closest('form') as HTMLFormElement);
		expect(await screen.findByRole('alert')).toHaveTextContent('no superar el saldo');
		expect(post).not.toHaveBeenCalled();
	});

	it('hides the payment form once the order is paid', async () => {
		get.mockResolvedValue(detail({ status: 'paid', amountPaid: 1000 }) as never);
		render(<OrderDetailPanel orderId="order-1" />);
		await screen.findByRole('list', { name: 'Etapas del pedido' });
		expect(screen.queryByLabelText('Monto recibido (MXN)')).not.toBeInTheDocument();
		expect(screen.getByText('Sin pagos registrados.')).toBeInTheDocument();
	});

	it('saves the event date', async () => {
		get.mockResolvedValue(detail() as never);
		patch.mockResolvedValue({ ok: true, status: 200, data: {} } as never);
		render(<OrderDetailPanel orderId="order-1" />);
		const input = await screen.findByLabelText('Fecha del evento');
		fireEvent.change(input, { target: { value: '2027-04-02' } });
		fireEvent.click(screen.getByRole('button', { name: 'Guardar fecha' }));
		await waitFor(() =>
			expect(patch).toHaveBeenCalledWith('/api/dashboard/commercial/orders/order-1/detail', {
				eventDate: '2027-04-02',
			}),
		);
	});
});
