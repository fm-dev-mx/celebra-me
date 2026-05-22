import {
	classifyImportedRows,
	reclassifyEditedRow,
	parseCsvLikeContent,
} from '@/components/dashboard/guests/ImportMagic.utils';
import type { ParsedGuest } from '@/components/dashboard/guests/ImportMagic.utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

const BASE_GUEST_ITEM: DashboardGuestItem = {
	guestId: '',
	inviteId: '',
	fullName: '',
	phone: '',
	phoneCountryCode: '',
	email: null,
	tags: [],
	metadata: {},
	maxAllowedAttendees: 2,
	attendanceStatus: 'pending',
	attendeeCount: 0,
	guestComment: '',
	deliveryStatus: 'generated',
	viewPercentage: 0,
	isViewed: false,
	firstViewedAt: null,
	respondedAt: null,
	waShareUrl: '',
	shareText: '',
	updatedAt: new Date().toISOString(),
};

function makeDashboardGuestItem(overrides: Partial<DashboardGuestItem>): DashboardGuestItem {
	return { ...BASE_GUEST_ITEM, ...overrides };
}

describe('classifyImportedRows', () => {
	const mkGuest = (overrides: Partial<ParsedGuest> = {}): ParsedGuest => ({
		fullName: 'Test',
		phone: '',
		phoneCountryCode: '',
		email: null,
		...overrides,
	});

	it('marks exact duplicate as skipped and hidden by default', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'ana lopez', phone: '+526691234567' })],
			existing,
		);
		expect(result[0]._status).toBe('exact_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('marks same name and both empty phones as probable duplicate', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'Ana López', phone: '' }),
		];
		const result = classifyImportedRows([mkGuest({ fullName: 'Ana Lopez' })], existing);
		expect(result[0]._status).toBe('probable_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].hiddenByDefault).toBe(true);
	});

	it('marks same phone with different name as update requiring review', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'Ana Familia', phone: '+526691234567' })],
			existing,
		);
		expect(result[0]._status).toBe('same_phone_update');
		expect(result[0].action).toBe('update');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('marks same name with different phone as create requiring review', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'ana lopez', phone: '+525551234567' })],
			existing,
		);
		expect(result[0]._status).toBe('same_name_different_phone');
		expect(result[0].action).toBe('create');
		expect(result[0].requiresReview).toBe(true);
	});

	it('marks same name with one missing phone as reviewable', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows([mkGuest({ fullName: 'ana lopez' })], existing);
		expect(result[0]._status).toBe('same_name_missing_phone');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('does not auto-select update target for ambiguous same-name matches', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
			makeDashboardGuestItem({
				guestId: 'ex-2',
				fullName: 'ana lopez',
				phone: '+525551234567',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'Ana Lopez', phone: '+521111111111' })],
			existing,
		);
		expect(result[0]._status).toBe('ambiguous_name_match');
		expect(result[0].action).toBe('skip');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBeUndefined();
	});

	it('marks imported duplicates as internal duplicates', () => {
		const result = classifyImportedRows(
			[
				mkGuest({ fullName: 'Ana', phone: '+526691234567' }),
				mkGuest({ fullName: 'Ana Copy', phone: '+526691234567' }),
			],
			[],
		);
		expect(result[0]._status).toBe('new');
		expect(result[1]._status).toBe('internal_duplicate');
		expect(result[1].action).toBe('skip');
		expect(result[1].requiresReview).toBe(true);
	});

	it('reclassifies edited duplicates into importable rows', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const rows = classifyImportedRows(
			[mkGuest({ fullName: 'Ana López', phone: '+526691234567' })],
			existing,
		);
		const edited = reclassifyEditedRow(
			rows,
			0,
			{ ...rows[0], fullName: 'Luis Pérez', phone: '+525551234567' },
			existing,
		);
		expect(edited[0]._status).toBe('new');
		expect(edited[0].action).toBe('create');
	});

	it('preserves explicit action only while still valid', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const rows = classifyImportedRows(
			[mkGuest({ fullName: 'Ana Familia', phone: '+526691234567' })],
			existing,
		);
		const skipped = classifyImportedRows(
			[{ ...rows[0], action: 'skip', actionTouched: true }],
			existing,
		);
		expect(skipped[0].action).toBe('skip');
		const invalidUpdate = classifyImportedRows(
			[{ ...rows[0], phone: '+525551234567', action: 'update', actionTouched: true }],
			[],
		);
		expect(invalidUpdate[0].action).toBe('create');
	});
});

describe('parseCsvLikeContent', () => {
	it('parses exported CSV without treating guest_id as name', () => {
		const result = parseCsvLikeContent(
			'guest_id,invite_id,full_name,phone,country_code,attendance_status,attendee_count,delivery_status,guest_comment\nabc,inv,Ana López,6691234567,+52,confirmed,2,shared,"Gracias"',
		);
		expect(result.rows[0].fullName).toBe('Ana López');
		expect(result.rows[0].phone).toBe('6691234567');
		expect(result.rows[0].phoneCountryCode).toBe('+52');
	});

	it('supports quoted CSV values', () => {
		const result = parseCsvLikeContent(
			'full_name,phone,email\n"López, Ana","+526691234567","ana@test.com"',
		);
		expect(result.rows[0].fullName).toBe('López, Ana');
		expect(result.rows[0].email).toBe('ana@test.com');
	});
});
