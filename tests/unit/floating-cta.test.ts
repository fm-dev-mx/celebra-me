import { floatingCtaMode, isFloatingCtaOn, isInFloatingZone } from '@/lib/invitation/floating-cta';

describe('floating reply button', () => {
	it('turns on only for the on token', () => {
		expect(isFloatingCtaOn(' on')).toBe(true);
		expect(isFloatingCtaOn('')).toBe(false);
		expect(isFloatingCtaOn('off')).toBe(false);
	});

	it('turns on by default on a personal link unless the profile sets it off', () => {
		expect(isFloatingCtaOn('', true)).toBe(true);
		expect(isFloatingCtaOn(' on', true)).toBe(true);
		expect(isFloatingCtaOn(' off', true)).toBe(false);
	});

	it('offers the reply, then the calendar, and nothing after a decline or on a locked card', () => {
		expect(floatingCtaMode('form', true)).toBe('confirm');
		expect(floatingCtaMode('confirmed', true)).toBe('calendar');
		expect(floatingCtaMode('confirmed', false)).toBe('none');
		expect(floatingCtaMode('declined', true)).toBe('none');
		expect(floatingCtaMode('locked', true)).toBe('none');
		expect(floatingCtaMode(undefined, true)).toBe('none');
	});

	it('floats between the cover and the end of the page', () => {
		expect(isInFloatingZone(100, 844, 10000)).toBe(false);
		expect(isInFloatingZone(3000, 844, 10000)).toBe(true);
		expect(isInFloatingZone(9000, 844, 10000)).toBe(false);
	});
});
