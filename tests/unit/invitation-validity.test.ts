import { resolveInvitationSchedule } from '@/lib/intake/invitation-validity';

const now = new Date('2026-09-09T01:00:00Z');
describe('invitation calendar validity', () => {
	it.each([
		['2026-09-07', 'past'],
		['2026-09-08', 'upcoming'],
		['2026-09-09', 'upcoming'],
		['2026-02-30', 'unknown'],
		['invalid', 'unknown'],
	])('classifies %s as %s in the event time zone', (date, expected) => {
		expect(resolveInvitationSchedule('client', { heroDate: date }, now).validity).toBe(
			expected,
		);
	});
	it('preserves floating legacy dates instead of converting their Z suffix', () => {
		expect(
			resolveInvitationSchedule('client', { heroDate: '2026-09-08T00:00:00.000Z' }, now),
		).toMatchObject({ eventDate: '2026-09-08', validity: 'upcoming' });
	});
	it('uses explicit timing and the event zone rather than the browser zone', () => {
		expect(
			resolveInvitationSchedule(
				'client',
				{
					eventTiming: { localDateTime: '2026-09-08T23:00', timeZone: 'Europe/Madrid' },
					heroDate: '2099-01-01',
				},
				now,
			).validity,
		).toBe('past');
	});
	it.each([
		{ localDateTime: '2026-02-30T12:00' },
		{ localDateTime: '2026-09-09T12:00', timeZone: 'Invalid/Zone' },
	])('does not mask invalid explicit timing', (eventTiming) => {
		expect(
			resolveInvitationSchedule('client', { eventTiming, heroDate: '2099-01-01' }, now)
				.validity,
		).toBe('unknown');
	});
	it('converts canonical UTC instants using the event zone', () => {
		expect(
			resolveInvitationSchedule(
				'client',
				{
					eventTiming: {
						startsAtUtc: '2026-09-09T01:00:00.000Z',
						timeZone: 'America/Chihuahua',
					},
				},
				now,
			).eventDate,
		).toBe('2026-09-08');
	});
	it('keeps missing dates unknown and demos exempt', () => {
		expect(resolveInvitationSchedule('client', undefined, now).validity).toBe('unknown');
		expect(resolveInvitationSchedule('demo', { heroDate: '2000-01-01' }, now).validity).toBe(
			'not_applicable',
		);
	});
});
