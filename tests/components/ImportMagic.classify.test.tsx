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

	it('marks same phone with different name as phone conflict requiring review', () => {
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
		expect(result[0]._status).toBe('phone_conflict');
		expect(result[0].action).toBe('skip');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('marks same name with different phone as possible duplicate', () => {
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
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].hiddenByDefault).toBe(true);
	});

	it('marks same name with one missing phone as possible duplicate', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows([mkGuest({ fullName: 'ana lopez' })], existing);
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
		expect(result[0].hiddenByDefault).toBe(true);
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
		expect(rows[0]._status).toBe('phone_conflict');
		// User can force skip
		const skipped = classifyImportedRows(
			[{ ...rows[0], action: 'skip', actionTouched: true }],
			existing,
		);
		expect(skipped[0].action).toBe('skip');
		// User can force create on a phone_conflict row
		const createOverride = classifyImportedRows(
			[{ ...rows[0], action: 'create', actionTouched: true }],
			existing,
		);
		expect(createOverride[0].action).toBe('create');
		// Update is also allowed for phone_conflict
		const updateOverride = classifyImportedRows(
			[{ ...rows[0], action: 'update', actionTouched: true }],
			existing,
		);
		expect(updateOverride[0].action).toBe('update');
	});

	// --- Regression tests from issue ---

	it('tist with different phone shows as possible duplicate (not auto-create)', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-tist',
				fullName: 'tist',
				phone: '+526561112244',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'tist', phone: '6563769461', phoneCountryCode: '+52' })],
			existing,
		);
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-tist');
	});

	it('accented and whitespace-padded names normalize to same key', () => {
		// This test checks two different CSV rows independently against the same existing guest.
		// Use non-conflicting phones so each row is evaluated separately.
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526561112244' }),
		];
		const result = classifyImportedRows(
			[
				mkGuest({ fullName: 'Tíst', phone: '+521111111111' }),
				mkGuest({ fullName: ' tist ', phone: '+522222222222' }),
			],
			existing,
		);
		// Both rows have same normalized name but different phones → possible_duplicate
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].matchedGuestId).toBe('ex-1');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[1]._status).toBe('possible_duplicate');
		expect(result[1].matchedGuestId).toBe('ex-1');
		expect(result[1].hiddenByDefault).toBe(true);
	});

	it('existing guest with phone, imported without phone shows as possible duplicate', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Rosita Lopez',
				phone: '+526691234567',
			}),
		];
		const result = classifyImportedRows([mkGuest({ fullName: 'Rosita Lopez' })], existing);
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	// -----------------------------------------------------------------------
	// Identity classification – identity runs before validation errors
	// -----------------------------------------------------------------------

	it('same canonical phone + same name → exact_duplicate, hidden, skip', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		// CSV: phone split across columns
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'tist', phone: '6563769461', phoneCountryCode: '+52' })],
			existing,
		);
		expect(result[0]._status).toBe('exact_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('same name + local phone without country code → possible_duplicate, hidden, error preserved', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		// CSV: phone without country code → validation error + name match
		const result = classifyImportedRows(
			[
				mkGuest({
					fullName: 'tist',
					phone: '6563769461',
					phoneCountryCode: '',
					error: 'Agrega el código de país',
				}),
			],
			existing,
		);
		// Identity detection overrides the error → possible_duplicate, NOT invalid
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].action).toBe('skip');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].error).toBeDefined(); // error preserved on the row
	});

	it('same name + local phone without country code, user action create → still skip because error blocks submission', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		const result = classifyImportedRows(
			[
				{
					...mkGuest({
						fullName: 'tist',
						phone: '6563769461',
						phoneCountryCode: '',
						error: 'Agrega el código de país',
					}),
					action: 'create',
					actionTouched: true,
				},
			],
			existing,
		);
		// User forced 'create' but error is preserved; applyActionPreference honors
		// the explicit action since it's allowed for possible_duplicate.
		// The caller (handleImport) filters rows where action=create and !error,
		// so this row won't be submitted.
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].action).toBe('create');
		expect(result[0].error).toBeDefined();
	});

	it('normalized name match with accents/whitespace → possible_duplicate, hidden', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'Tíst  ', phone: '+526563769461' }),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'tist', phone: '+521111111111' })],
			existing,
		);
		expect(result[0]._status).toBe('possible_duplicate');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('same canonical phone + different name → phone_conflict, review, skip', () => {
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Another Person',
				phone: '+526563769461',
			}),
		];
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'tist', phone: '6563769461', phoneCountryCode: '+52' })],
			existing,
		);
		expect(result[0]._status).toBe('phone_conflict');
		expect(result[0].action).toBe('skip');
		expect(result[0].hiddenByDefault).toBe(false);
		expect(result[0].requiresReview).toBe(true);
		expect(result[0].matchedGuestId).toBe('ex-1');
	});

	it('duplicate row with error and action=skip does not block import', () => {
		// The caller side (handleImport) only considers rows with action=create
		// or action=update AND !error. A skip row is never submitted regardless.
		// This test verifies the classify side respects that contract.
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		const result = classifyImportedRows(
			[
				mkGuest({
					fullName: 'tist',
					phone: '6563769461',
					phoneCountryCode: '',
					error: 'Agrega el código de país',
				}),
			],
			existing,
		);
		expect(result[0].action).toBe('skip');
		// The row should not appear in a "create" or "update" submit list
		expect(result[0]._status).not.toBe('new');
		expect(result[0]._status).not.toBe('invalid');
	});

	it('exported CSV roundtrip: re-imported guest is exact_duplicate, not new', () => {
		// Simulate: a guest in DB with full international phone
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Ana López',
				phone: '+526691234567',
			}),
		];
		// The export writes country_code + local phone (split by splitPhoneForExport)
		// Re-import: parse that CSV row back
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'Ana López', phone: '6691234567', phoneCountryCode: '+52' })],
			existing,
		);
		expect(result[0]._status).toBe('exact_duplicate');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].action).toBe('skip');
	});

	it('exported CSV roundtrip: legacy plain-digit phone without known prefix', () => {
		// Guest with legacy phone that has no known country prefix
		const existing = [
			makeDashboardGuestItem({
				guestId: 'ex-1',
				fullName: 'Juan Perez',
				phone: '6681234567',
			}),
		];
		// Export writes phone as-is, country_code empty
		const result = classifyImportedRows(
			[mkGuest({ fullName: 'Juan Perez', phone: '6681234567', phoneCountryCode: '' })],
			existing,
		);
		// Phone matches (both are digits-only "6681234567") → exact_duplicate
		expect(result[0]._status).toBe('exact_duplicate');
		expect(result[0].hiddenByDefault).toBe(true);
		expect(result[0].action).toBe('skip');
	});

	it('same phone number with different formatting is recognized as same canonical phone', () => {
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		// Various formatting of the same number
		const result = classifyImportedRows(
			[
				mkGuest({ fullName: 'tist', phone: '6563769461', phoneCountryCode: '+52' }),
				mkGuest({ fullName: 'tist', phone: '+526563769461', phoneCountryCode: '' }),
				mkGuest({ fullName: 'tist', phone: '+52 656 376 9461', phoneCountryCode: '' }),
			],
			existing,
		);
		// First row matches existing by phone+name → exact_duplicate
		expect(result[0]._status).toBe('exact_duplicate');
		expect(result[0].hiddenByDefault).toBe(true);
		// Rows 1 and 2 share the same canonical phone as row 0 → internal_duplicate
		expect(result[1]._status).toBe('internal_duplicate');
		expect(result[1].requiresReview).toBe(true);
		expect(result[2]._status).toBe('internal_duplicate');
		expect(result[2].requiresReview).toBe(true);
	});

	it('duplicate row with preserved error cannot be submitted as create without fixing the error', () => {
		// Simulate: implicit contract verified at the handleImport level
		const existing = [
			makeDashboardGuestItem({ guestId: 'ex-1', fullName: 'tist', phone: '+526563769461' }),
		];
		const row: ParsedGuest = {
			...mkGuest({
				fullName: 'tist',
				phone: '6563769461',
				phoneCountryCode: '',
				error: 'Agrega el código de país',
			}),
			action: 'create',
			actionTouched: true,
		};
		const result = classifyImportedRows([row], existing);
		// Even with explicit 'create', the caller should skip it because error is set
		// This test verifies the row still reports both action=create AND error
		expect(result[0].action).toBe('create');
		expect(result[0].error).toBeDefined();
		// handleImport uses: action === 'create' && !error → so this row is excluded
		const wouldBeSubmitted = result.filter((g) => g.action === 'create' && !g.error);
		expect(wouldBeSubmitted).toHaveLength(0);
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
