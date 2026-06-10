import { resolveDefaultMessageKind } from '@/lib/rsvp/services/shared/message-type-resolver';

describe('resolveDefaultMessageKind', () => {
	it('never shared → invitation', () => {
		expect(resolveDefaultMessageKind({ firstSharedAt: null })).toBe('invitation');
	});

	it('already shared → reminder', () => {
		expect(resolveDefaultMessageKind({ firstSharedAt: '2026-01-15T10:00:00.000Z' })).toBe(
			'reminder',
		);
	});

	it('declined → invitation regardless of share state', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				attendanceStatus: 'declined',
			}),
		).toBe('invitation');
		expect(
			resolveDefaultMessageKind({ firstSharedAt: null, attendanceStatus: 'declined' }),
		).toBe('invitation');
	});

	it('confirmed + shared → reminder', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				attendanceStatus: 'confirmed',
			}),
		).toBe('reminder');
	});
});
