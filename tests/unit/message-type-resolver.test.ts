import { resolveDefaultMessageKind } from '@/lib/rsvp/services/shared/message-type-resolver';

describe('resolveDefaultMessageKind', () => {
	it('never shared → invitation', () => {
		expect(resolveDefaultMessageKind({ firstSharedAt: null })).toBe('invitation');
	});

	it('already shared (legacy, no deliveryStatus) → reminder', () => {
		expect(resolveDefaultMessageKind({ firstSharedAt: '2026-01-15T10:00:00.000Z' })).toBe(
			'reminder',
		);
	});

	it('deliveryStatus generated → invitation even if firstSharedAt is set', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				deliveryStatus: 'generated',
			}),
		).toBe('invitation');
	});

	it('deliveryStatus shared → reminder', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: null,
				deliveryStatus: 'shared',
			}),
		).toBe('reminder');
	});

	it('deliveryStatus shared with firstSharedAt → reminder', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				deliveryStatus: 'shared',
			}),
		).toBe('reminder');
	});

	it('deliveryStatus generated + firstSharedAt null → invitation', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: null,
				deliveryStatus: 'generated',
			}),
		).toBe('invitation');
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

	it('confirmed + generated deliveryStatus → invitation', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				attendanceStatus: 'confirmed',
				deliveryStatus: 'generated',
			}),
		).toBe('invitation');
	});

	it('confirmed + shared deliveryStatus → reminder', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				attendanceStatus: 'confirmed',
				deliveryStatus: 'shared',
			}),
		).toBe('reminder');
	});

	it('legacy null deliveryStatus with firstSharedAt → reminder', () => {
		expect(
			resolveDefaultMessageKind({
				firstSharedAt: '2026-01-15T10:00:00.000Z',
				deliveryStatus: undefined,
			}),
		).toBe('reminder');
	});
});
