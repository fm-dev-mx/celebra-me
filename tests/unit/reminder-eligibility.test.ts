import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type { ReminderSettings } from '@/lib/rsvp/services/shared/share-message-defaults';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	getReminderEligibleGuests,
	isUnconfirmedSharedGuest,
	shouldShowReminderCta,
} from '@/components/dashboard/guests/reminder-eligibility';

function makeDateContext(
	overrides: Partial<ShareMessageDateContext> = {},
): ShareMessageDateContext {
	return {
		eventDate: '15 de junio de 2026',
		daysUntilEvent: '5',
		rawDaysUntilEvent: 5,
		rsvpDeadline: '10 de junio de 2026',
		eventTimingText: 'Te recordamos que faltan 5 días para Nuestro evento.',
		rsvpDeadlineText: 'Confirma tu asistencia antes del 10 de junio de 2026.',
		...overrides,
	};
}

function makeSettings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
	return {
		enabled: true,
		showWhenDaysBeforeEvent: 7,
		audience: 'unconfirmed',
		...overrides,
	};
}

describe('isUnconfirmedSharedGuest', () => {
	it('returns true for shared + pending guest', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending' }),
			),
		).toBe(true);
	});

	it('returns false for shared + confirmed guest', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' }),
			),
		).toBe(false);
	});

	it('returns false for shared + declined guest', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'declined' }),
			),
		).toBe(false);
	});

	it('returns false for generated guest even if pending', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' }),
			),
		).toBe(false);
	});

	it('returns false for generated guest even if firstSharedAt exists', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({
					deliveryStatus: 'generated',
					attendanceStatus: 'pending',
					firstSharedAt: '2026-05-01T00:00:00.000Z',
				}),
			),
		).toBe(false);
	});

	it('returns false for confirmed guest regardless of delivery status', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'confirmed' }),
			),
		).toBe(false);
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' }),
			),
		).toBe(false);
	});

	it('returns false for declined guest regardless of delivery status', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'declined' }),
			),
		).toBe(false);
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'declined' }),
			),
		).toBe(false);
	});

	it('returns true for shared + viewed + pending (still eligible)', () => {
		expect(
			isUnconfirmedSharedGuest(
				makeGuest({
					deliveryStatus: 'shared',
					attendanceStatus: 'pending',
					isViewed: true,
				}),
			),
		).toBe(true);
	});

	it('porConfirmar count matches getReminderEligibleGuests(items, unconfirmed).length', () => {
		const items = [
			makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' }),
			makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending' }),
			makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' }),
			makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'declined' }),
			makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending', isViewed: true }),
		];
		const porConfirmarCount = items.filter((g) => isUnconfirmedSharedGuest(g)).length;
		expect(porConfirmarCount).toBe(2);
		expect(porConfirmarCount).toBe(getReminderEligibleGuests(items, 'unconfirmed').length);
	});
});

describe('getReminderEligibleGuests', () => {
	describe('audience: unconfirmed', () => {
		it('includes shared + pending guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending' })];
			const result = getReminderEligibleGuests(items, 'unconfirmed');
			expect(result).toHaveLength(1);
		});

		it('excludes shared + confirmed guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' })];
			const result = getReminderEligibleGuests(items, 'unconfirmed');
			expect(result).toHaveLength(0);
		});

		it('excludes shared + declined guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'declined' })];
			const result = getReminderEligibleGuests(items, 'unconfirmed');
			expect(result).toHaveLength(0);
		});

		it('excludes generated guests even if pending', () => {
			const items = [makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' })];
			const result = getReminderEligibleGuests(items, 'unconfirmed');
			expect(result).toHaveLength(0);
		});

		it('excludes generated guests even if firstSharedAt exists', () => {
			const items = [
				makeGuest({
					deliveryStatus: 'generated',
					attendanceStatus: 'pending',
					firstSharedAt: '2026-05-01T00:00:00.000Z',
				}),
			];
			const result = getReminderEligibleGuests(items, 'unconfirmed');
			expect(result).toHaveLength(0);
		});
	});

	describe('audience: all-shared', () => {
		it('includes shared + pending guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'pending' })];
			const result = getReminderEligibleGuests(items, 'all-shared');
			expect(result).toHaveLength(1);
		});

		it('includes shared + confirmed guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'confirmed' })];
			const result = getReminderEligibleGuests(items, 'all-shared');
			expect(result).toHaveLength(1);
		});

		it('excludes shared + declined guests', () => {
			const items = [makeGuest({ deliveryStatus: 'shared', attendanceStatus: 'declined' })];
			const result = getReminderEligibleGuests(items, 'all-shared');
			expect(result).toHaveLength(0);
		});

		it('excludes generated guests', () => {
			const items = [makeGuest({ deliveryStatus: 'generated', attendanceStatus: 'pending' })];
			const result = getReminderEligibleGuests(items, 'all-shared');
			expect(result).toHaveLength(0);
		});
	});

	it('returns empty array for empty guest list', () => {
		expect(getReminderEligibleGuests([], 'unconfirmed')).toEqual([]);
		expect(getReminderEligibleGuests([], 'all-shared')).toEqual([]);
	});
});

describe('shouldShowReminderCta', () => {
	it('returns true when within threshold and eligible guests exist', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 5 });
		const settings = makeSettings({ showWhenDaysBeforeEvent: 7 });
		expect(shouldShowReminderCta(ctx, settings, 3)).toBe(true);
	});

	it('returns true at exact boundary (daysUntilEvent === threshold)', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 7 });
		const settings = makeSettings({ showWhenDaysBeforeEvent: 7 });
		expect(shouldShowReminderCta(ctx, settings, 1)).toBe(true);
	});

	it('returns false when daysUntilEvent exceeds threshold', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 8 });
		const settings = makeSettings({ showWhenDaysBeforeEvent: 7 });
		expect(shouldShowReminderCta(ctx, settings, 3)).toBe(false);
	});

	it('returns false when event has passed (negative rawDaysUntilEvent)', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: -1, daysUntilEvent: '', eventDate: '' });
		const settings = makeSettings();
		expect(shouldShowReminderCta(ctx, settings, 3)).toBe(false);
	});

	it('returns false when rawDaysUntilEvent is null (missing event date)', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: null, daysUntilEvent: '', eventDate: '' });
		const settings = makeSettings();
		expect(shouldShowReminderCta(ctx, settings, 3)).toBe(false);
	});

	it('returns false when reminders are disabled', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 5 });
		const settings = makeSettings({ enabled: false });
		expect(shouldShowReminderCta(ctx, settings, 3)).toBe(false);
	});

	it('returns false when no eligible guests', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 5 });
		const settings = makeSettings();
		expect(shouldShowReminderCta(ctx, settings, 0)).toBe(false);
	});

	it('returns true on day of event (rawDaysUntilEvent === 0)', () => {
		const ctx = makeDateContext({ rawDaysUntilEvent: 0, daysUntilEvent: '0' });
		const settings = makeSettings({ showWhenDaysBeforeEvent: 7 });
		expect(shouldShowReminderCta(ctx, settings, 2)).toBe(true);
	});
});
