import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type { ReminderSettings } from '@/lib/rsvp/services/shared/share-message-defaults';
import { makeGuest } from '@tests/helpers/guest-factory';
import {
	getReminderEligibleGuests,
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
