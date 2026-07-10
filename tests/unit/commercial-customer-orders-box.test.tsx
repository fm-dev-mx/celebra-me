import { fireEvent, render, screen } from '@testing-library/react';

import CustomerOrdersBox, { type SalesOrder } from '@/components/dashboard/commercial/CustomerOrdersBox';

// Base order with all default fields set
const baseOrder: SalesOrder = {
	id: 'order-1',
	orderNumber: 'CMO-20260708-ABC123',
	customerId: 'cust-1',
	status: 'confirmed',
	eventType: 'xv',
	currency: 'MXN',
	totalAmount: 2500,
	depositAmount: 899,
	amountPaid: 899,
	depositPaidAt: null,
	paidAt: null,
};

const defaultProps = {
	customerOrders: [baseOrder],
	depositAmounts: {} as Record<string, string>,
	onAmountChange: jest.fn(),
	markingDepositPaid: {} as Record<string, boolean>,
	onMarkDepositPaid: jest.fn(),
};

describe('CustomerOrdersBox', () => {
	it('renders confirmed status badge in Spanish', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText('Confirmado')).toBeInTheDocument();
	});

	it('renders waiting status for deposit_paid orders', () => {
		const depositPaidOrder: SalesOrder = {
			...baseOrder,
			status: 'deposit_paid',
			depositPaidAt: '2026-07-08T14:00:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[depositPaidOrder]} />);
		expect(screen.getByText('Anticipo pagado')).toBeInTheDocument();
	});

	it('renders paid status badge', () => {
		const paidOrder: SalesOrder = {
			...baseOrder,
			status: 'paid',
			amountPaid: 2500,
			paidAt: '2026-07-08T14:00:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />);
		expect(screen.getByText('Totalmente pagado')).toBeInTheDocument();
	});

	it('renders quoted status badge', () => {
		const quotedOrder: SalesOrder = { ...baseOrder, status: 'quoted' };
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[quotedOrder]} />);
		expect(screen.getByText('Cotizado')).toBeInTheDocument();
	});

	it('shows deposit button for confirmed orders and hides it for deposit_paid', () => {
		const { rerender } = render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder]} />,
		);
		// Confirmed order should show the deposit button
		expect(screen.getByText('Registrar anticipo')).toBeInTheDocument();

		// deposit_paid order should NOT show the deposit button
		const depositPaidOrder: SalesOrder = { ...baseOrder, status: 'deposit_paid' };
		rerender(
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[depositPaidOrder]}
				markingDepositPaid={{}}
			/>,
		);
		expect(screen.queryByText('Registrar anticipo')).not.toBeInTheDocument();
	});

	it('renders multiple orders', () => {
		const order2: SalesOrder = {
			...baseOrder,
			id: 'order-2',
			orderNumber: 'CMO-20260708-DEF456',
			status: 'deposit_paid',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder, order2]} />);
		expect(screen.getByText('CMO-20260708-ABC123')).toBeInTheDocument();
		expect(screen.getByText('CMO-20260708-DEF456')).toBeInTheDocument();
		expect(screen.getByText('Confirmado')).toBeInTheDocument();
		expect(screen.getByText('Anticipo pagado')).toBeInTheDocument();
	});

	it('does not render blank labels for event type or amounts', () => {
		const minimalOrder: SalesOrder = {
			id: 'order-min',
			orderNumber: 'CMO-MIN',
			customerId: 'cust-1',
			status: 'confirmed',
			eventType: 'xv',
			currency: 'MXN',
			totalAmount: 999,
			amountPaid: 0,
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[minimalOrder]} />);

		// Check that event type renders with a readable label, not just "Evento:"
		const descEl = screen.getByText(/Evento:/);
		expect(descEl).toBeInTheDocument();
		expect(descEl.textContent).not.toBe('Evento:');
		expect(descEl.textContent).toContain('XV años');
	});

	it('renders event type with human-readable label', () => {
		const xvOrder: SalesOrder = { ...baseOrder, eventType: 'xv' };
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[xvOrder]} />);
		// Should show 'XV años', not raw 'xv'
		expect(screen.getByText(/XV años/)).toBeInTheDocument();
	});

	it('shows balance when amountPaid is less than total', () => {
		const orderWithBalance: SalesOrder = {
			...baseOrder,
			totalAmount: 2500,
			amountPaid: 899,
			status: 'deposit_paid',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[orderWithBalance]} />);

		// Balance should be 2500 - 899 = 1601
		expect(screen.getByText(/Saldo:/)).toBeInTheDocument();
		expect(screen.getByText(/\$1,601/)).toBeInTheDocument();
	});

	it('shows zero balance when fully paid', () => {
		const paidOrder: SalesOrder = {
			...baseOrder,
			status: 'paid',
			totalAmount: 2500,
			amountPaid: 2500,
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />);
		expect(screen.getByText(/Saldo:/)).toBeInTheDocument();
		expect(screen.getByText('$0')).toBeInTheDocument();
	});

	it('renders deposit paid timestamp when available', () => {
		const depositPaidOrder: SalesOrder = {
			...baseOrder,
			status: 'deposit_paid',
			amountPaid: 899,
			depositPaidAt: '2026-07-08T14:30:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[depositPaidOrder]} />);
		// Check the timestamp is displayed (using locale es-MX)
		expect(screen.getByText(/Anticipo pagado el/)).toBeInTheDocument();
	});

	it('renders paid timestamp when order is fully paid', () => {
		const paidOrder: SalesOrder = {
			...baseOrder,
			status: 'paid',
			amountPaid: 1800,
			paidAt: '2026-07-08T16:00:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />);
		expect(screen.getByText(/Pagado el/)).toBeInTheDocument();
	});

	it('renders the deposit label in Spanish', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText('Anticipo recibido ($ MXN)')).toBeInTheDocument();
	});

	it('disables deposit button when effective amount would be missing or non-positive', () => {
		// Order with no depositAmount: effective value is empty -> disabled
		const noDefaultOrder: SalesOrder = {
			...baseOrder,
			depositAmount: null,
		};
		const { rerender } = render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[noDefaultOrder]} />,
		);
		expect(screen.getByText('Registrar anticipo')).toBeDisabled();

		// Order with depositAmount = 899: effective value is 899 -> enabled
		rerender(<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder]} />);
		expect(screen.getByText('Registrar anticipo')).toBeEnabled();
	});

	it('input displays the order depositAmount as default fallback', () => {
		const orderWithDeposit: SalesOrder = { ...baseOrder, depositAmount: 899 };
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[orderWithDeposit]} />);
		const input = screen.getByDisplayValue('899');
		expect(input).toBeInTheDocument();
	});

	it('deposit button is disabled while the payment is being processed server-side', () => {
		render(<CustomerOrdersBox {...defaultProps} markingDepositPaid={{ 'order-1': true }} />);
		expect(screen.getByText('Registrando...')).toBeDisabled();
	});

	it('shows an empty message when there are no orders', () => {
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[]} />);
		expect(screen.getByText('Este cliente aún no tiene órdenes registradas.')).toBeInTheDocument();
	});

	it('calls onAmountChange when typing in the deposit input', () => {
		const order1: SalesOrder = { ...baseOrder, id: 'order-1', depositAmount: 0 };
		const order2: SalesOrder = { ...baseOrder, id: 'order-2', orderNumber: 'CMO-20260708-DEF456' };
		const onAmountChange = jest.fn();

		render(
			<CustomerOrdersBox
				customerOrders={[order1, order2]}
				depositAmounts={{}}
				onAmountChange={onAmountChange}
				markingDepositPaid={{}}
				onMarkDepositPaid={jest.fn()}
			/>,
		);

		// Simulate typing in the first order's input
		const inputs = screen.getAllByRole('spinbutton');
		fireEvent.change(inputs[0], { target: { value: '1200' } });
		expect(onAmountChange).toHaveBeenCalledWith('order-1', '1200');
	});

	it('flags inconsistent amounts instead of presenting a false zero balance', () => {
		render(
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[
					{
						...baseOrder,
						status: 'deposit_paid',
						totalAmount: 3000,
						amountPaid: 3500,
					},
				]}
			/>,
		);

		expect(screen.getByText('Por conciliar')).toBeInTheDocument();
		expect(screen.getByText(/el pagado supera el total/)).toHaveTextContent('$500');
	});
});
