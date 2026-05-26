import { PREDEFINED_GUEST_TAGS, isSystemTag, getVisibleTags } from '@/lib/guests/guest-tags';

describe('PREDEFINED_GUEST_TAGS', () => {
	it('contains the expected group names', () => {
		expect(PREDEFINED_GUEST_TAGS).toEqual(['Familia', 'Amigos', 'VIP', 'Trabajo']);
	});
});

describe('isSystemTag', () => {
	it('returns true for system: prefixed tags', () => {
		expect(isSystemTag('system:public')).toBe(true);
		expect(isSystemTag('system:imported')).toBe(true);
	});

	it('returns false for regular tags', () => {
		expect(isSystemTag('Familia')).toBe(false);
		expect(isSystemTag('VIP')).toBe(false);
	});
});

describe('getVisibleTags', () => {
	it('filters out system: prefixed tags', () => {
		const result = getVisibleTags(['system:public', 'Familia', 'system:imported', 'VIP']);
		expect(result).toEqual(['Familia', 'VIP']);
	});

	it('returns all tags when none are system', () => {
		expect(getVisibleTags(['Familia', 'Amigos'])).toEqual(['Familia', 'Amigos']);
	});

	it('returns empty array when all tags are system', () => {
		expect(getVisibleTags(['system:public', 'system:imported'])).toEqual([]);
	});

	it('returns empty array for empty input', () => {
		expect(getVisibleTags([])).toEqual([]);
	});

	it('handles null input gracefully', () => {
		expect(getVisibleTags(null as unknown as string[])).toEqual([]);
	});
});
