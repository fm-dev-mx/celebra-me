import { eventDetailsBlockSchema } from '@/lib/intake/schemas/intake-block.schema';
import { getVisibleFields } from '@/lib/intake/blocks';
import { getFieldLabel } from '@/lib/intake/labels';

describe('eventDate validation', () => {
	it('accepts YYYY-MM-DD from HTML date input', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('accepts full ISO datetime string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20T18:00:00.000Z',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('accepts ISO datetime without timezone', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '2027-11-20T18:00:00',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: '',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toContain('obligatoria');
		}
	});

	it('rejects undefined date', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
	});

	it('rejects gibberish string', () => {
		const result = eventDetailsBlockSchema.safeParse({
			celebrantName: 'Ana',
			eventLabel: 'XV Anos',
			eventDate: 'not-a-date',
			eventTitle: 'XV Ana',
		});
		expect(result.success).toBe(false);
	});
});

describe('getVisibleFields', () => {
	it('shows secondaryName for boda events', () => {
		const fields = getVisibleFields('boda', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).toContain('secondaryName');
	});

	it('hides secondaryName for xv events', () => {
		const fields = getVisibleFields('xv', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('hides secondaryName for bautizo events', () => {
		const fields = getVisibleFields('bautizo', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('hides secondaryName for cumple events', () => {
		const fields = getVisibleFields('cumple', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('hides secondaryName for baby-shower events', () => {
		const fields = getVisibleFields('baby-shower', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('secondaryName');
	});

	it('shows secondaryName for primera-comunion events', () => {
		const fields = getVisibleFields('primera-comunion', 'event-details');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).toContain('secondaryName');
	});

	it('shows spouseName for boda events', () => {
		const fields = getVisibleFields('boda', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).toContain('spouseName');
	});

	it('hides spouseName for xv events', () => {
		const fields = getVisibleFields('xv', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('spouseName');
	});

	it('hides spouseName for baby-shower events', () => {
		const fields = getVisibleFields('baby-shower', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('spouseName');
	});

	it('hides spouseName for primera-comunion events', () => {
		const fields = getVisibleFields('primera-comunion', 'main-people');
		const fieldNames = fields.map((f) => f.name);
		expect(fieldNames).not.toContain('spouseName');
	});

	it('shows celebrantName for all event types', () => {
		for (const eventType of [
			'xv',
			'boda',
			'bautizo',
			'cumple',
			'baby-shower',
			'primera-comunion',
		] as const) {
			const fields = getVisibleFields(eventType, 'event-details');
			const fieldNames = fields.map((f) => f.name);
			expect(fieldNames).toContain('celebrantName');
		}
	});

	it('shows fatherName for all event types', () => {
		for (const eventType of [
			'xv',
			'boda',
			'bautizo',
			'cumple',
			'baby-shower',
			'primera-comunion',
		] as const) {
			const fields = getVisibleFields(eventType, 'main-people');
			const fieldNames = fields.map((f) => f.name);
			expect(fieldNames).toContain('fatherName');
		}
	});

	it('uses baby-shower-specific hero name label', () => {
		expect(getFieldLabel('hero', 'name', 'baby-shower')).toBe('Nombre del bebé');
	});

	it('uses primera-comunion-specific hero name label', () => {
		expect(getFieldLabel('hero', 'name', 'primera-comunion')).toBe('Nombre del niño(a)');
	});

	it('uses primera-comunion-specific hero secondaryName label', () => {
		expect(getFieldLabel('hero', 'secondaryName', 'primera-comunion')).toBe(
			'Nombre del segundo niño(a)',
		);
	});
});
