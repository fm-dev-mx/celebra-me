import { render, screen, within } from '@testing-library/react';
import { OrdersAgenda, OrdersStageBoard } from '@/components/dashboard/orders/OrdersFollowUp';
import {
	buildAgenda,
	daysUntil,
	groupOrdersByStage,
	pendingOf,
	type FollowUpOrder,
} from '@/lib/commercial/order-follow-up';

const TODAY = '2026-11-11';
const order = (overrides: Partial<FollowUpOrder>): FollowUpOrder => ({
	id: 'o1',
	orderNumber: 'CM-1',
	totalAmount: 1000,
	amountPaid: 0,
	eventDate: null,
	stage: 'quoted',
	...overrides,
});

describe('order follow-up helpers', () => {
	it('groups orders into the seven stage columns and leaves closed ones out', () => {
		const columns = groupOrdersByStage([
			order({ id: 'a', stage: 'deposit' }),
			order({ id: 'b', stage: 'deposit' }),
			order({ id: 'c', stage: null }),
		]);
		expect(columns.map((column) => column.label)).toEqual([
			'Cotizado',
			'Confirmado',
			'Anticipo',
			'Datos recibidos',
			'En producción',
			'Publicada',
			'Liquidado',
		]);
		expect(columns[2].orders.map((item) => item.id)).toEqual(['a', 'b']);
		expect(columns.flatMap((column) => column.orders)).toHaveLength(2);
	});

	it('lists what is still open on an order', () => {
		expect(pendingOf(order({ stage: 'deposit', amountPaid: 400 }))).toEqual([
			'data',
			'design',
			'balance',
		]);
		expect(pendingOf(order({ stage: 'data_received', amountPaid: 1000 }))).toEqual(['design']);
		expect(pendingOf(order({ stage: 'published', amountPaid: 1000 }))).toEqual([]);
		expect(pendingOf(order({ stage: null }))).toEqual([]);
	});

	it('counts whole days to the event', () => {
		expect(daysUntil('2026-11-18', TODAY)).toBe(7);
		expect(daysUntil('2026-11-10', TODAY)).toBe(-1);
	});

	it('sorts the agenda by date, marks the week, and drops finished past events', () => {
		const agenda = buildAgenda(
			[
				order({ id: 'far', orderNumber: 'CM-3', eventDate: '2027-02-01' }),
				order({ id: 'soon', orderNumber: 'CM-2', eventDate: '2026-11-15' }),
				order({ id: 'nodate', orderNumber: 'CM-4', eventDate: null }),
				order({ id: 'done', eventDate: '2026-10-01', stage: 'settled', amountPaid: 1000 }),
				order({ id: 'closed', eventDate: '2026-11-14', stage: null }),
				order({
					id: 'ready',
					eventDate: '2026-11-12',
					stage: 'published',
					amountPaid: 1000,
				}),
			],
			TODAY,
		);
		expect(agenda.map((entry) => entry.order.id)).toEqual(['ready', 'soon', 'far']);
		expect(agenda.map((entry) => entry.urgent)).toEqual([false, true, false]);
	});
});

describe('follow-up views', () => {
	it('renders the stage board with counts and an urgency note in words', () => {
		render(
			<OrdersStageBoard
				today={TODAY}
				orders={[order({ id: 'a', stage: 'deposit', eventDate: '2026-11-13' })]}
			/>,
		);
		const column = screen.getByRole('listitem', { name: 'Anticipo: 1' });
		expect(within(column).getByText('CM-1')).toBeTruthy();
		expect(within(column).getByText('Requiere acción esta semana')).toBeTruthy();
		expect(screen.getByRole('listitem', { name: 'Cotizado: 0' })).toBeTruthy();
	});

	it('renders the agenda with pending items', () => {
		render(
			<OrdersAgenda
				today={TODAY}
				orders={[order({ stage: 'deposit', amountPaid: 400, eventDate: '2026-11-12' })]}
			/>,
		);
		expect(screen.getByText(/Mañana/)).toBeTruthy();
		expect(screen.getByText('Requiere acción esta semana')).toBeTruthy();
		expect(screen.getByText(/Faltan datos · Diseño pendiente · Saldo/)).toBeTruthy();
	});

	it('says so when there are no upcoming events', () => {
		render(<OrdersAgenda today={TODAY} orders={[order({})]} />);
		expect(screen.getByText(/No hay eventos próximos/)).toBeTruthy();
	});
});
