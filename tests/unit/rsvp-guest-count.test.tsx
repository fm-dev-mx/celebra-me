import { render, act } from '@testing-library/react';
import React from 'react';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';
import type { EventType } from '@/lib/theme/theme-contract';

function createTestHarness(
	overrides: Partial<{
		guestCap: number;
		eventType: EventType;
		eventSlug: string;
		accessMode: 'personalized-only' | 'hybrid';
		prefersReducedMotion: boolean;
		isDemoPreview: boolean;
		initialGuestData: {
			fullName?: string;
			maxAllowedAttendees?: number;
			inviteId?: string;
			attendanceStatus?: 'pending' | 'confirmed' | 'declined';
			attendeeCount?: number;
		};
	}> = {},
) {
	let hook: ReturnType<typeof useRsvpSubmission> | null = null;

	const Harness = () => {
		hook = useRsvpSubmission({
			guestCap: 5,
			eventType: 'xv',
			eventSlug: 'test',
			accessMode: 'personalized-only',
			prefersReducedMotion: false,
			...overrides,
		});
		return null;
	};

	const { unmount } = render(React.createElement(Harness));
	return { getHook: () => hook, unmount };
}

describe('RSVP guest count behavior', () => {
	it('initializes to maxAllowedAttendees when provided', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 5 },
		});
		expect(getHook()?.attendeeCount).toBe(5);
	});

	it('initializes to guestCap when maxAllowedAttendees is not provided', () => {
		const { getHook } = createTestHarness({
			guestCap: 8,
		});
		expect(getHook()?.attendeeCount).toBe(8);
	});

	it('uses maxAllowedAttendees over guestCap when both are available', () => {
		const { getHook } = createTestHarness({
			guestCap: 10,
			initialGuestData: { maxAllowedAttendees: 4 },
		});
		expect(getHook()?.attendeeCount).toBe(4);
	});

	it('defaults to maxAllowedAttendees when attendeeCount is 0 (unresponded guest)', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 4, attendeeCount: 0 },
		});
		expect(getHook()?.attendeeCount).toBe(4);
	});

	it('defaults to maxAllowedAttendees (2) when attendeeCount is 0', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 2, attendeeCount: 0 },
		});
		expect(getHook()?.attendeeCount).toBe(2);
	});

	it('defaults to maxAllowedAttendees (1) when attendeeCount is 0 and cap is 1', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 1, attendeeCount: 0 },
		});
		expect(getHook()?.attendeeCount).toBe(1);
	});

	it('preserves existing attendeeCount when guest already responded (3)', () => {
		const { getHook } = createTestHarness({
			initialGuestData: {
				maxAllowedAttendees: 4,
				attendeeCount: 3,
				attendanceStatus: 'confirmed',
			},
		});
		expect(getHook()?.attendeeCount).toBe(3);
	});

	it('preserves existing attendeeCount when guest already responded (1)', () => {
		const { getHook } = createTestHarness({
			initialGuestData: {
				maxAllowedAttendees: 4,
				attendeeCount: 1,
				attendanceStatus: 'confirmed',
			},
		});
		expect(getHook()?.attendeeCount).toBe(1);
	});

	it('preserves attendeeCount when toggling confirmed -> declined -> confirmed', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 5 },
		});

		act(() => {
			getHook()!.setAttendanceStatus('confirmed');
		});
		expect(getHook()!.attendeeCount).toBe(5);

		act(() => {
			getHook()!.setAttendanceStatus('declined');
		});
		expect(getHook()!.attendeeCount).toBe(5);

		act(() => {
			getHook()!.setAttendanceStatus('confirmed');
		});
		expect(getHook()!.attendeeCount).toBe(5);
	});

	it('preserves a user-edited guest count across attendance toggles', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 5 },
		});

		act(() => {
			getHook()!.setAttendeeCount('3');
		});
		expect(getHook()!.attendeeCount).toBe('3');

		act(() => {
			getHook()!.setAttendanceStatus('confirmed');
		});
		expect(getHook()!.attendeeCount).toBe('3');

		act(() => {
			getHook()!.setAttendanceStatus('declined');
		});
		expect(getHook()!.attendeeCount).toBe('3');

		act(() => {
			getHook()!.setAttendanceStatus('confirmed');
		});
		expect(getHook()!.attendeeCount).toBe('3');
	});

	it('defaults to 1 when effectiveGuestCap is 1 (no plus-ones)', () => {
		const { getHook } = createTestHarness({
			guestCap: 1,
			initialGuestData: { maxAllowedAttendees: 1 },
		});
		expect(getHook()?.attendeeCount).toBe(1);
	});

	it('initializes to guestCap in demo preview mode', () => {
		const { getHook } = createTestHarness({
			isDemoPreview: true,
			guestCap: 6,
		});
		expect(getHook()?.attendeeCount).toBe(6);
	});

	it('allows guest to reduce from maxAllowedAttendees to a lower valid number (4->2)', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 4, attendeeCount: 0 },
		});
		expect(getHook()?.attendeeCount).toBe(4);

		act(() => {
			getHook()!.setAttendeeCount('2');
		});
		expect(getHook()!.attendeeCount).toBe('2');
	});

	it('does not clamp on setAttendeeCount — validation handles clamping', () => {
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 4, attendeeCount: 0 },
		});
		act(() => {
			getHook()!.setAttendanceStatus('confirmed');
		});
		// The effectiveGuestCap is 4 — values should not exceed it
		act(() => {
			getHook()!.setAttendeeCount('10');
		});
		expect(getHook()!.attendeeCount).toBe('10'); // setAttendeeCount doesn't clamp; validation does
	});

	it('sets attendeeCount to 0 only when initial status is declined', () => {
		const { getHook } = createTestHarness({
			initialGuestData: {
				maxAllowedAttendees: 4,
				attendeeCount: 0,
				attendanceStatus: 'declined',
			},
		});
		// When initialGuestData has attendanceStatus='declined', initialAttendeeCount should be 0
		expect(getHook()!.attendeeCount).toBe(0);
	});

	it('preserves attendeeCount when toggling to declined (submission-time normalization)', () => {
		// The hook preserves attendeeCount through toggles; normalization
		// to 0 for declined happens at submission time via normalizeGuestCount.
		const { getHook } = createTestHarness({
			initialGuestData: { maxAllowedAttendees: 4, attendeeCount: 0 },
		});
		expect(getHook()!.attendeeCount).toBe(4); // defaults to maxAllowedAttendees

		act(() => {
			getHook()!.setAttendanceStatus('declined');
		});
		expect(getHook()!.attendeeCount).toBe(4); // preserved across toggle
	});
});

describe('RSVP phone country code preservation', () => {
	it('preserves a non-default country code when typing plain digits', () => {
		const { getHook } = createTestHarness();

		act(() => {
			getHook()!.setCountryCode('+1');
		});
		expect(getHook()!.countryCode).toBe('+1');

		act(() => {
			getHook()!.handlePhoneChange('9150011122');
		});
		expect(getHook()!.phone).toBe('9150011122');
		expect(getHook()!.countryCode).toBe('+1');
	});

	it('does NOT reset countryCode to +52 when typing plain national digits', () => {
		const { getHook } = createTestHarness();

		act(() => {
			getHook()!.setCountryCode('+1');
		});

		act(() => {
			getHook()!.handlePhoneChange('9150011122');
		});
		expect(getHook()!.countryCode).not.toBe(DEFAULT_COUNTRY_CODE);
		expect(getHook()!.countryCode).toBe('+1');
	});

	it('updates countryCode from input when value starts with +', () => {
		const { getHook } = createTestHarness();

		act(() => {
			getHook()!.handlePhoneChange('+52 669 123 4567');
		});
		expect(getHook()!.phone).toBe('6691234567');
		expect(getHook()!.countryCode).toBe('+52');
	});

	it('detects +1 country code from explicit international input', () => {
		const { getHook } = createTestHarness();

		act(() => {
			getHook()!.handlePhoneChange('+1 915 001 1122');
		});
		expect(getHook()!.phone).toBe('9150011122');
		expect(getHook()!.countryCode).toBe('+1');
	});
});
