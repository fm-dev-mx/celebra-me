// tests/unit/commercial-customer-orders-box.test.tsx
// Component tests for CustomerOrdersBox — order display mapping regression coverage

import { render, screen, fireEvent } from '@testing-library/react';
import CustomerOrdersBox from '@/components/dashboard/commercial/CustomerOrdersBox';
import type { SalesOrder } from '@/components/dashboard/commercial/CustomerOrdersBox';

const baseOrder: SalesOrder = {
	id: 'order-1',
	orderNumber: 'CMO-20260708-ABC123',
	customerId: 'customer-id',
	status: 'confirmed',
	eventType: 'xv',
	packageName: 'Premium',
	currency: 'MXN',
	totalAmount: 1800,
	depositAmount: 899,
	amountPaid: 0,
};

const defaultProps = {
	customerOrders: [baseOrder],
	depositAmounts: {},
	onAmountChange: jest.fn(),
	markingDepositPaid: {},
	onMarkDepositPaid: jest.fn(),
};

describe('CustomerOrdersBox', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('renders empty state when there are no orders', () => {
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[]} />);
		expect(
			screen.getByText('Este cliente aún no tiene órdenes registradas.'),
		).toBeInTheDocument();
	});

	it('renders the order number', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText('CMO-20260708-ABC123')).toBeInTheDocument();
	});

	it('renders event type with human-readable label', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/Evento:/)).toBeInTheDocument();
		// Now shows the label 'XV años' instead of raw slug 'xv'
		expect(screen.getByText(/XV años/)).toBeInTheDocument();
		// Verify no blank label — event type is not empty or undefined
		const eventText = screen.getByText(/Evento:/).textContent || '';
		expect(eventText).not.toBe('Evento:');
		expect(eventText).not.toBe('Evento: ');
	});

	it('renders package name when present', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/Paquete: Premium/)).toBeInTheDocument();
	});

	it('renders total amount formatted with MXN currency', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		// The total amount is now formatted with locale es-MX: $1,800
		// balance is also $1,800 (0 paid), so use getAllByText
		const amounts = screen.getAllByText('$1,800');
		expect(amounts.length).toBe(2); // Total and Balance
	});

	it('renders paid amount', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		// Paid amount shows as $0 (formatted with locale)
		expect(screen.getByText('$0')).toBeInTheDocument();
	});

	it('renders the confirmed status badge', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText('Confirmado')).toBeInTheDocument();
	});

	it('renders deposit_paid status badge', () => {
		const depositPaidOrder: SalesOrder = {
			...baseOrder,
			status: 'deposit_paid',
			amountPaid: 899,
			depositPaidAt: '2026-07-08T14:00:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[depositPaidOrder]} />);
		expect(screen.getByText('Anticipo Pagado')).toBeInTheDocument();
	});

	it('renders paid status badge', () => {
		const paidOrder: SalesOrder = {
			...baseOrder,
			status: 'paid',
			amountPaid: 1800,
			paidAt: '2026-07-08T14:00:00.000Z',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />);
		expect(screen.getByText('Totalmente Pagado')).toBeInTheDocument();
	});

	it('renders quoted status badge', () => {
		const quotedOrder: SalesOrder = {
			...baseOrder,
			status: 'quoted',
		};
		render(<CustomerOrdersBox {...defaultProps} customerOrders={[quotedOrder]} />);
		expect(screen.getByText('Cotizado')).toBeInTheDocument();
	});

	it('shows deposit paid button only for confirmed or quoted orders', () => {
		const { rerender } = render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder]} />,
		);
		// Confirmed order should show the deposit button
		expect(screen.getByText('Registrar Anticipo')).toBeInTheDocument();

		// deposit_paid order should NOT show the deposit button
		const depositPaidOrder: SalesOrder = { ...baseOrder, status: 'deposit_paid' };
		rerender(
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[depositPaidOrder]}
				markingDepositPaid={{}} />,
		);
		expect(screen.queryByText('Registrar Anticipo')).not.toBeInTheDocument();
	});

	it('renders multiple orders', () => {
		const order2: SalesOrder = {
			...baseOrder,
			id: 'order-2',
			orderNumber: 'CMO-20260708-DEF456',
			eventType: 'boda',
			totalAmount: 2500,
			amountPaid: 500,
			status: 'deposit_paid',
		};
		render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder, order2]} />,
		);
		expect(screen.getByText('CMO-20260708-ABC123')).toBeInTheDocument();
		expect(screen.getByText('CMO-20260708-DEF456')).toBeInTheDocument();
		expect(screen.getByText('Confirmado')).toBeInTheDocument();
		expect(screen.getByText('Anticipo Pagado')).toBeInTheDocument();
	});

	it('does not render blank labels for event type or amounts', () => {
		// Simulate a minimal order with only the essential fields
		const minimalOrder: SalesOrder = {
			id: 'order-min',
			orderNumber: 'CMO-20260708-MIN',
			customerId: 'customer-id',
			status: 'confirmed',
			eventType: 'cumple',
			currency: 'MXN',
			totalAmount: 999,
			amountPaid: 0,
		};
		render(
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[minimalOrder]}
			/>,
		);

		// Check that event type renders with a readable label, not just "Evento:"
		const descEl = screen.getByText(/Evento:/);
		expect(descEl.textContent).not.toMatch(/^Evento:\s*$/);
		// Now renders as "Cumpleaños" instead of raw slug "cumple"
		expect(screen.getByText(/Cumpleaños/)).toBeInTheDocument();

		// Check that total and paid amounts are not blank
		const found999 = screen.getAllByText('$999');
		expect(found999.length).toBeGreaterThanOrEqual(1);
	});

	it('calculates balance due as total minus amount paid', () => {
		const orderWithBalance: SalesOrder = {
			...baseOrder,
			totalAmount: 2500,
			amountPaid: 899,
			status: 'deposit_paid',
		};
		render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[orderWithBalance]} />,
		);

		// Balance should be 2500 - 899 = 1601
		expect(screen.getByText(/Saldo:/)).toBeInTheDocument();
		// The formatted amount should be $1,601
		expect(screen.getByText('$1,601')).toBeInTheDocument();
	});

	it('shows zero balance when fully paid', () => {
		const paidOrder: SalesOrder = {
			...baseOrder,
			totalAmount: 2500,
			amountPaid: 2500,
			status: 'paid',
		};
		render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />,
		);
		expect(screen.getByText(/Saldo:/)).toBeInTheDocument();
		expect(screen.getByText('$0')).toBeInTheDocument();
	});

	it('renders event type as human-readable label instead of raw slug', () => {
		const xvOrder: SalesOrder = {
			...baseOrder,
			eventType: 'xv',
		};
		const { container } = render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[xvOrder]} />,
		);
		// Should show 'XV años', not raw 'xv'
		expect(screen.getByText(/XV años/)).toBeInTheDocument();
		const descText = container.querySelector('.order-desc')?.textContent || '';
		expect(descText).toContain('XV años');
	});

	it('renders deposit paid timestamp when available', () => {
		const depositPaidOrder: SalesOrder = {
			...baseOrder,
			status: 'deposit_paid',
			amountPaid: 899,
			depositPaidAt: '2026-07-08T14:30:00.000Z',
		};
		render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[depositPaidOrder]} />,
		);
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
		render(
			<CustomerOrdersBox {...defaultProps} customerOrders={[paidOrder]} />,
		);
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
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[noDefaultOrder]}
			/>,
		);
		expect(screen.getByText('Registrar Anticipo')).toBeDisabled();

		// Order with depositAmount = 899: effective value is 899 -> enabled
		rerender(
			<CustomerOrdersBox {...defaultProps} customerOrders={[baseOrder]} />,
		);
		expect(screen.getByText('Registrar Anticipo')).toBeEnabled();
	});

	it('input displays the order depositAmount as default fallback', () => {
		const orderWithDeposit: SalesOrder = {
			...baseOrder,
			depositAmount: 899,
		};
		render(
			<CustomerOrdersBox
				{...defaultProps}
				customerOrders={[orderWithDeposit]}
			/>,
		);
		const input = screen.getByDisplayValue('899');
		expect(input).toBeInTheDocument();
	});

	it('deposit button is disabled while the payment is being processed server-side', () => {
		render(
			<CustomerOrdersBox
				{...defaultProps}
				markingDepositPaid={{ 'order-1': true }}
			/>,
		);
		expect(screen.getByText('Registrando...')).toBeDisabled();
	});

	it('deposit amount change handler is wired correctly per order id', () => {
		const order1: SalesOrder = { ...baseOrder, id: 'order-1' };
		const order2: SalesOrder = {
			...baseOrder,
			id: 'order-2',
			orderNumber: 'CMO-20260708-DEF456',
			depositAmount: 500,
		};
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

		// There should be two number inputs
		const inputs = screen.getAllByRole('spinbutton');
		expect(inputs).toHaveLength(2);

		// Simulate typing in the first order's input
		fireEvent.change(inputs[0], { target: { value: '1200' } });
		expect(onAmountChange).toHaveBeenCalledWith('order-1', '1200');
	});
});
