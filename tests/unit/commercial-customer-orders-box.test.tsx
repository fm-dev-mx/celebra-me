// tests/unit/commercial-customer-orders-box.test.tsx
// Component tests for CustomerOrdersBox — order display mapping regression coverage

import { render, screen } from '@testing-library/react';
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

	it('renders event type with label', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/Evento:/)).toBeInTheDocument();
		expect(screen.getByText(/xv/)).toBeInTheDocument();
		// Verify no blank label — event type is not empty or undefined
		const eventText = screen.getByText(/Evento:/).textContent || '';
		expect(eventText).not.toBe('Evento:');
		expect(eventText).not.toBe('Evento: ');
	});

	it('renders package name when present', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/Paquete: Premium/)).toBeInTheDocument();
	});

	it('renders total amount with MXN currency', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/\$1800 MXN/)).toBeInTheDocument();
	});

	it('renders paid amount with MXN currency', () => {
		render(<CustomerOrdersBox {...defaultProps} />);
		expect(screen.getByText(/\$0 MXN/)).toBeInTheDocument();
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
				markingDepositPaid={{}}
			/>,
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

		// Check that event type renders with a value, not just "Evento:"
		const descEl = screen.getByText(/Evento:/);
		expect(descEl.textContent).not.toMatch(/^Evento:\s*$/);
		expect(descEl.textContent).toContain('cumple');

		// Check that total and paid amounts are not blank
		const priceEl = screen.getByText(/Total:/);
		expect(priceEl.textContent).not.toMatch(/Total:\s*\$\s*MXN/);
		expect(priceEl.textContent).toContain('$999');
	});
});
