import { parseCsvLikeContent } from '@/components/dashboard/guests/ImportMagic.utils';
import { CHILDREN_EXCEED_PASSES_MESSAGE } from '@/lib/rsvp/guest-cap';

const HEADER = 'nombre,telefono,clave_pais,max_allowed_attendees,niños';
const PHONE = '6561234567,+52';

function parseRow(row: string, header = HEADER) {
	return parseCsvLikeContent(`${header}\n${row}`).rows[0];
}

describe('import: children column keeps adult and child passes apart', () => {
	it('reads «niños» as child passes inside the passes', () => {
		const row = parseRow(`Ana,${PHONE},4,2`);
		expect(row).toMatchObject({ maxAllowedAttendees: 4, maxAllowedChildren: 2 });
		expect(row.error).toBeUndefined();
	});

	it('accepts children equal to the passes (an all-children pass)', () => {
		const row = parseRow(`Ana,${PHONE},3,3`);
		expect(row.error).toBeUndefined();
		expect(row.fieldErrors).toBeUndefined();
	});

	it('rejects more children than passes', () => {
		const row = parseRow(`Ana,${PHONE},2,3`);
		expect(row.fieldErrors?.maxAllowedChildren).toBe(CHILDREN_EXCEED_PASSES_MESSAGE);
		expect(row.error).toBe(CHILDREN_EXCEED_PASSES_MESSAGE);
	});

	it('rejects a negative children count', () => {
		const row = parseRow(`Ana,${PHONE},2,-1`);
		expect(row.fieldErrors?.maxAllowedChildren).toBeTruthy();
	});

	it('leaves a non-numeric children value unset, so it counts as 0', () => {
		for (const value of ['abc', 'dos', '']) {
			const row = parseRow(`Ana,${PHONE},2,${value}`);
			expect(row.maxAllowedChildren).toBeUndefined();
			expect(row.fieldErrors?.maxAllowedChildren).toBeUndefined();
		}
	});

	it('treats a missing children column as 0 child passes', () => {
		const row = parseRow(`Ana,${PHONE},2`, 'nombre,telefono,clave_pais,max_allowed_attendees');
		expect(row.maxAllowedChildren).toBeUndefined();
		expect(row.error).toBeUndefined();
	});

	it('validates children against the default of 2 passes when the passes column is missing', () => {
		const header = 'nombre,telefono,clave_pais,niños';
		expect(parseRow(`Ana,${PHONE},2`, header).error).toBeUndefined();
		expect(parseRow(`Ana,${PHONE},3`, header).fieldErrors?.maxAllowedChildren).toBe(
			CHILDREN_EXCEED_PASSES_MESSAGE,
		);
	});
});
