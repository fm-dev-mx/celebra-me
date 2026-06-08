import {
	str,
	strFallback,
	bool,
	boolFallback,
	num,
	numFallback,
	hasRsvpContent,
	mergeOverlay,
} from '@/lib/intake/utils';

describe('str', () => {
	it('returns the string for non-empty strings', () => {
		expect(str('hello')).toBe('hello');
	});

	it('returns undefined for empty strings', () => {
		expect(str('')).toBeUndefined();
	});

	it('returns undefined for non-strings', () => {
		expect(str(42)).toBeUndefined();
		expect(str(null)).toBeUndefined();
		expect(str(undefined)).toBeUndefined();
		expect(str({})).toBeUndefined();
	});
});

describe('strFallback', () => {
	it('returns the string for strings', () => {
		expect(strFallback('hello')).toBe('hello');
		expect(strFallback('')).toBe('');
	});

	it('returns empty string for non-strings', () => {
		expect(strFallback(null)).toBe('');
		expect(strFallback(undefined)).toBe('');
		expect(strFallback(42)).toBe('');
	});
});

describe('bool', () => {
	it('returns the boolean for booleans', () => {
		expect(bool(true)).toBe(true);
		expect(bool(false)).toBe(false);
	});

	it('returns undefined for non-booleans', () => {
		expect(bool(null)).toBeUndefined();
		expect(bool(1)).toBeUndefined();
		expect(bool('true')).toBeUndefined();
	});
});

describe('boolFallback', () => {
	it('returns the boolean for booleans', () => {
		expect(boolFallback(true)).toBe(true);
		expect(boolFallback(false)).toBe(false);
	});

	it('returns false for non-booleans', () => {
		expect(boolFallback(null)).toBe(false);
		expect(boolFallback(undefined)).toBe(false);
		expect(boolFallback(0)).toBe(false);
	});
});

describe('num', () => {
	it('returns the number for numbers', () => {
		expect(num(42)).toBe(42);
		expect(num(0)).toBe(0);
	});

	it('returns undefined for non-numbers', () => {
		expect(num(null)).toBeUndefined();
		expect(num('42')).toBeUndefined();
		expect(num(undefined)).toBeUndefined();
	});
});

describe('numFallback', () => {
	it('returns the number for numbers', () => {
		expect(numFallback(42)).toBe(42);
		expect(numFallback(0)).toBe(0);
	});

	it('returns 0 for non-numbers', () => {
		expect(numFallback(null)).toBe(0);
		expect(numFallback('42')).toBe(0);
		expect(numFallback(undefined)).toBe(0);
	});
});

describe('hasRsvpContent', () => {
	it('returns true when rsvp has a title', () => {
		expect(hasRsvpContent({ rsvp: { title: 'Confirmación' } })).toBe(true);
	});

	it('returns true when rsvp has a guestCap', () => {
		expect(hasRsvpContent({ rsvp: { guestCap: 10 } })).toBe(true);
	});

	it('returns false when rsvp is empty', () => {
		expect(hasRsvpContent({ rsvp: {} })).toBe(false);
	});

	it('returns false when content is undefined', () => {
		expect(hasRsvpContent(undefined)).toBe(false);
	});

	it('returns false when rsvp is missing', () => {
		expect(hasRsvpContent({})).toBe(false);
	});
});

describe('mergeOverlay', () => {
	it('merges two flat objects', () => {
		const result = mergeOverlay({ a: 1, b: 2 }, { b: 3, c: 4 });
		expect(result).toEqual({ a: 1, b: 3, c: 4 });
	});

	it('merges nested objects recursively', () => {
		const result = mergeOverlay({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } });
		expect(result).toEqual({ a: { x: 1, y: 99, z: 3 } });
	});

	it('overwrites arrays entirely', () => {
		const result = mergeOverlay({ items: [1, 2] }, { items: [3] });
		expect(result).toEqual({ items: [3] });
	});

	it('does not mutate the base object', () => {
		const base = { a: { b: 1 } };
		const result = mergeOverlay(base, { a: { c: 2 } });
		expect(base).toEqual({ a: { b: 1 } });
		expect(result).toEqual({ a: { b: 1, c: 2 } });
	});

	it('overwrites with null values', () => {
		const result = mergeOverlay({ a: 1, b: 2 }, { a: null });
		expect(result).toEqual({ a: null, b: 2 });
	});

	it('handles empty overlays', () => {
		const result = mergeOverlay({ a: 1 }, {});
		expect(result).toEqual({ a: 1 });
	});
});
