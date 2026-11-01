import {
	clampScrollY,
	createHeaderScrollState,
	nextHeaderScrollState,
	readHeaderScrollThresholds,
	resyncHeaderScrollState,
	DEFAULT_HEADER_SCROLL_THRESHOLDS,
	type HeaderScrollState,
} from '@/lib/dom/header-scroll';

const MAX_Y = 5000;

function run(start: HeaderScrollState, positions: number[], maxY = MAX_Y) {
	const states: HeaderScrollState[] = [];
	let state = start;
	for (const y of positions) {
		state = nextHeaderScrollState(state, y, maxY);
		states.push(state);
	}
	return states;
}

function hiddenAt(y: number): HeaderScrollState {
	return { y, travel: 0, hidden: true, scrolled: true };
}

describe('clampScrollY', () => {
	it('keeps rubber-band overscroll inside the real scroll range', () => {
		expect(clampScrollY(-30, MAX_Y)).toBe(0);
		expect(clampScrollY(MAX_Y + 40, MAX_Y)).toBe(MAX_Y);
		expect(clampScrollY(120, -10)).toBe(0);
	});
});

describe('nextHeaderScrollState', () => {
	it('does not toggle visibility on small back-and-forth jitter', () => {
		const visible = createHeaderScrollState(1000, MAX_Y);
		const jitter = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1003 : 1000));

		expect(run(visible, jitter).every((s) => !s.hidden)).toBe(true);
		expect(run(hiddenAt(1000), jitter).every((s) => s.hidden)).toBe(true);
	});

	it('hides only after sustained downward travel', () => {
		const states = run(createHeaderScrollState(1000, MAX_Y), [1010, 1020, 1030]);
		expect(states.map((s) => s.hidden)).toEqual([false, false, true]);
	});

	it('shows again only after sustained upward travel', () => {
		const states = run(hiddenAt(2000), [1980, 1960, 1940]);
		expect(states.map((s) => s.hidden)).toEqual([true, true, false]);
	});

	it('restarts the travel count when the direction changes', () => {
		const states = run(hiddenAt(2000), [1970, 1990, 1960]);
		expect(states.map((s) => s.hidden)).toEqual([true, true, true]);
	});

	it('ignores the bounce past the end of the page', () => {
		const states = run(hiddenAt(MAX_Y), [MAX_Y + 60, MAX_Y + 20, MAX_Y]);
		expect(states.every((s) => s.hidden)).toBe(true);
	});

	it('is always visible near the top and tracks the shrink threshold', () => {
		const [nearTop, top] = run(hiddenAt(400), [90, 20]);
		expect(nearTop).toMatchObject({ hidden: false, scrolled: true });
		expect(top).toMatchObject({ hidden: false, scrolled: false });
	});
});

describe('resyncHeaderScrollState', () => {
	it('accepts a jump (URL bar, anchor) without changing visibility', () => {
		expect(resyncHeaderScrollState(hiddenAt(2000), 1200, MAX_Y)).toMatchObject({
			y: 1200,
			travel: 0,
			hidden: true,
		});
		expect(resyncHeaderScrollState(hiddenAt(2000), 60, MAX_Y).hidden).toBe(false);
	});
});

describe('readHeaderScrollThresholds', () => {
	it('reads data attributes and falls back to defaults', () => {
		const header = document.createElement('header');
		expect(readHeaderScrollThresholds(header)).toEqual(DEFAULT_HEADER_SCROLL_THRESHOLDS);

		header.dataset.thresholdShrink = '80';
		header.dataset.thresholdHide = '160';
		header.dataset.thresholdDirection = '30';
		expect(readHeaderScrollThresholds(header)).toMatchObject({
			shrinkAt: 80,
			hideAt: 160,
			hideDistance: 30,
			showDistance: 60,
		});
	});
});
