import { render, act } from '@testing-library/react';
import React from 'react';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';

function createTestHarness(
	overrides: Partial<{
		guestCap: number;
		eventType: 'xv' | 'boda' | 'bautizo' | 'cumple' | 'baby-shower';
		eventSlug: string;
		accessMode: 'personalized-only' | 'hybrid';
		prefersReducedMotion: boolean;
		isDemoPreview: boolean;
		initialGuestData: { fullName?: string; maxAllowedAttendees?: number; inviteId?: string };
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
