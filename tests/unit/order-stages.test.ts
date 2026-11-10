import { ORDER_STAGE_KEYS, deriveOrderStages } from '@/lib/commercial/order-stages';

const doneKeys = (input: Parameters<typeof deriveOrderStages>[0]) =>
	deriveOrderStages(input)
		.steps.filter((step) => step.done)
		.map((step) => step.key);

describe('deriveOrderStages', () => {
	it('always lists the seven stages in order', () => {
		const result = deriveOrderStages({ status: 'quoted', amountPaid: 0 });
		expect(result.steps.map((step) => step.key)).toEqual([...ORDER_STAGE_KEYS]);
		expect(result.steps).toHaveLength(7);
	});

	it('starts at Cotizado for a quote', () => {
		const result = deriveOrderStages({ status: 'quoted', amountPaid: 0 });
		expect(result.current).toBe('quoted');
		expect(doneKeys({ status: 'quoted', amountPaid: 0 })).toEqual(['quoted']);
	});

	it('reaches Confirmado without a deposit', () => {
		expect(deriveOrderStages({ status: 'confirmed', amountPaid: 0 }).current).toBe('confirmed');
	});

	it('reaches Anticipo once the deposit is paid', () => {
		const result = deriveOrderStages({ status: 'deposit_paid', amountPaid: 500 });
		expect(result.current).toBe('deposit');
		expect(doneKeys({ status: 'deposit_paid', amountPaid: 500 })).toEqual([
			'quoted',
			'confirmed',
			'deposit',
		]);
	});

	it('marks data received from a submitted request or an invitation in production', () => {
		expect(
			deriveOrderStages({
				status: 'deposit_paid',
				amountPaid: 500,
				dataRequestStatus: 'submitted',
			}).current,
		).toBe('data_received');
		expect(
			deriveOrderStages({
				status: 'deposit_paid',
				amountPaid: 500,
				dataRequestStatus: 'sent',
			}).current,
		).toBe('deposit');
	});

	it('reaches En producción and Publicada from the linked invitation', () => {
		expect(
			deriveOrderStages({
				status: 'deposit_paid',
				amountPaid: 500,
				invitationStatus: 'preview_sent',
			}).current,
		).toBe('in_production');
		const published = deriveOrderStages({
			status: 'deposit_paid',
			amountPaid: 500,
			invitationStatus: 'published',
		});
		expect(published.current).toBe('published');
		expect(published.steps.find((step) => step.key === 'settled')?.done).toBe(false);
	});

	it('reaches Liquidado when the order is paid, even before publication', () => {
		const result = deriveOrderStages({ status: 'paid', amountPaid: 1000 });
		expect(result.current).toBe('settled');
		expect(result.steps.find((step) => step.key === 'published')?.done).toBe(false);
	});

	it('does not count a draft invitation as production', () => {
		expect(
			deriveOrderStages({
				status: 'deposit_paid',
				amountPaid: 500,
				invitationStatus: 'draft',
			}).current,
		).toBe('deposit');
	});

	it('shows nothing reached for cancelled or lost orders', () => {
		for (const status of ['cancelled', 'lost'] as const) {
			const result = deriveOrderStages({
				status,
				amountPaid: 500,
				invitationStatus: 'published',
			});
			expect(result.current).toBeNull();
			expect(result.steps.every((step) => !step.done)).toBe(true);
		}
	});
});
