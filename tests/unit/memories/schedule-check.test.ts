import { resolveMemoriesRetentionWarningDays } from '@/lib/memories/contract/catalog';
import { checkMemoriesSchedule } from '@/lib/memories/client/schedule-check';

const VALID = {
	uploadStartsLocal: '2026-10-23T00:00',
	uploadEndsLocal: '2026-11-07T00:00',
	retentionEndsLocal: '2027-01-06T00:00',
	eventDate: '2026-10-30',
};

describe('checkMemoriesSchedule', () => {
	it('describes a valid window around the event date', () => {
		expect(checkMemoriesSchedule(VALID)).toEqual({
			startsIssue: null,
			endsIssue: null,
			retentionIssue: null,
			valid: true,
			retentionDays: 75,
			daysBeforeEvent: 7,
			daysAfterEvent: 8,
		});
	});

	it('rejects a close that is not after the opening', () => {
		const check = checkMemoriesSchedule({ ...VALID, uploadEndsLocal: '2026-10-23T00:00' });
		expect(check).toMatchObject({ endsIssue: 'ends_before_start', valid: false });
	});

	it('rejects a retention that ends before the close', () => {
		const check = checkMemoriesSchedule({ ...VALID, retentionEndsLocal: '2026-11-06T23:59' });
		expect(check).toMatchObject({ retentionIssue: 'retention_before_end', valid: false });
	});

	it('enforces the 150-day object lifetime from the opening', () => {
		expect(
			checkMemoriesSchedule({ ...VALID, retentionEndsLocal: '2027-03-22T00:00' }),
		).toMatchObject({ retentionIssue: null, retentionDays: 150, valid: true });
		expect(
			checkMemoriesSchedule({ ...VALID, retentionEndsLocal: '2027-03-22T00:01' }),
		).toMatchObject({ retentionIssue: 'retention_too_long', valid: false });
	});

	it('flags empty fields and tolerates an unknown event date', () => {
		expect(
			checkMemoriesSchedule({ ...VALID, uploadStartsLocal: '', eventDate: null }),
		).toMatchObject({
			startsIssue: 'missing',
			valid: false,
			retentionDays: null,
			daysBeforeEvent: null,
			daysAfterEvent: null,
		});
	});
});

describe('resolveMemoriesRetentionWarningDays', () => {
	const space = { retentionEndsAt: '2027-01-06T07:00:00.000Z' };

	it('counts down only inside the warning window and before retention ends', () => {
		const at = (iso: string) => resolveMemoriesRetentionWarningDays(space, new Date(iso), 14);
		expect(at('2026-12-20T07:00:00.000Z')).toBeNull();
		expect(at('2026-12-23T07:00:00.000Z')).toBe(14);
		expect(at('2027-01-05T08:00:00.000Z')).toBe(1);
		expect(at('2027-01-06T07:00:00.000Z')).toBeNull();
		expect(at('2027-02-01T00:00:00.000Z')).toBeNull();
	});
});
