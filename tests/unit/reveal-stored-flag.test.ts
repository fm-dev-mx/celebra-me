import {
	REVEAL_MEMORY_MS,
	buildRevealStoredValue,
	buildStoredRevealFreshExpression,
	isStoredRevealFresh,
} from '@/lib/invitation/reveal-manager';

const NOW = Date.UTC(2026, 10, 19, 18, 0, 0);

const evaluateInline = (raw: string | null, now: number): boolean => {
	const expression = buildStoredRevealFreshExpression('raw');
	const realNow = Date.now;
	Date.now = () => now;
	try {
		return new Function('raw', `return ${expression};`)(raw) as boolean;
	} finally {
		Date.now = realNow;
	}
};

describe('stored reveal flag', () => {
	const cases: Array<[string, string | null, number, boolean]> = [
		['missing flag', null, NOW, false],
		['legacy permanent flag', 'true', NOW, false],
		['garbage', 'abc', NOW, false],
		['opened a minute ago', String(NOW - 60_000), NOW, true],
		['opened just inside the window', String(NOW - REVEAL_MEMORY_MS + 1), NOW, true],
		['opened exactly at the window edge', String(NOW - REVEAL_MEMORY_MS), NOW, false],
		['opened yesterday', String(NOW - 24 * 60 * 60 * 1000), NOW, false],
		['clock moved back before the opening', String(NOW + 60_000), NOW, false],
	];

	it.each(cases)('%s', (_label, raw, now, expected) => {
		expect(isStoredRevealFresh(raw, now)).toBe(expected);
		expect(evaluateInline(raw, now)).toBe(expected);
	});

	it('writes the opening time', () => {
		expect(buildRevealStoredValue(NOW)).toBe(String(NOW));
		expect(isStoredRevealFresh(buildRevealStoredValue(NOW), NOW)).toBe(true);
	});

	it('remembers an opening for twelve hours', () => {
		expect(REVEAL_MEMORY_MS).toBe(12 * 60 * 60 * 1000);
	});
});
