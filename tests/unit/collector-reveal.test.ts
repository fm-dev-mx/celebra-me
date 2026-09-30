import {
	autoTurnPoint,
	constrainCorner,
	foldGeometry,
	polygonCss,
	shouldCompleteOnRelease,
	spreadTransform,
	stepSpring,
	springAtRest,
	cubicBezier,
	easePeel,
	FOLLOW_SPRING,
	RELEASE_SPRING,
	TIMELINE,
	COLLECTOR_FALLBACK_MS,
	RELEASE_THRESHOLD,
} from '../../src/components/invitation/editorial-cover/collector-reveal';

const W = 300;
const H = 450;
const bottomCorner = { x: W, y: H };

const reflect = (matrix: number[], p: { x: number; y: number }) => ({
	x: matrix[0] * p.x + matrix[2] * p.y + matrix[4],
	y: matrix[1] * p.x + matrix[3] * p.y + matrix[5],
});

describe('collector cover fold geometry', () => {
	it('shows the whole front and no flap while the cover rests', () => {
		const g = foldGeometry(bottomCorner, bottomCorner, W, H);
		expect(g.front).toHaveLength(4);
		expect(g.flap).toHaveLength(0);
		expect(g.progress).toBe(0);
		expect(polygonCss(g.flap)).toBe('polygon(0 0, 0 0, 0 0)');
	});

	it('mirrors the whole cover onto the left page when fully open', () => {
		const g = foldGeometry(bottomCorner, { x: -W, y: H }, W, H);
		expect(g.front.length).toBeLessThan(3);
		expect(g.flap).toHaveLength(4);
		expect(g.progress).toBe(1);
		expect(g.matrix.map((v) => Math.round(v * 1000) / 1000 + 0)).toEqual([-1, 0, 0, 1, 0, 0]);
	});

	it('reflects the grabbed corner exactly onto the pointer', () => {
		const point = { x: 120, y: 360 };
		const g = foldGeometry(bottomCorner, point, W, H);
		const mapped = reflect(g.matrix, bottomCorner);
		expect(mapped.x).toBeCloseTo(point.x, 5);
		expect(mapped.y).toBeCloseTo(point.y, 5);
		expect(g.front.length).toBeGreaterThanOrEqual(3);
		expect(g.flap.length).toBeGreaterThanOrEqual(3);
	});

	it('keeps the page attached to the spine', () => {
		const p = constrainCorner({ x: -900, y: -900 }, bottomCorner, W, H);
		expect(Math.hypot(p.x - 0, p.y - H)).toBeLessThanOrEqual(W + 1e-6);
		expect(Math.hypot(p.x - 0, p.y - 0)).toBeLessThanOrEqual(Math.hypot(W, H) + 1e-6);
	});

	it('runs the automatic turn from the resting corner to the left page', () => {
		expect(autoTurnPoint(bottomCorner, 0, W, H)).toEqual(bottomCorner);
		const end = autoTurnPoint(bottomCorner, 1, W, H);
		expect(end.x).toBeCloseTo(-W, 5);
		expect(end.y).toBeCloseTo(H, 5);
		expect(autoTurnPoint(bottomCorner, 0.5, W, H).y).toBeLessThan(H);
	});

	it('completes a released drag past the threshold or on a leftward flick', () => {
		expect(shouldCompleteOnRelease(RELEASE_THRESHOLD + 0.01, 0)).toBe(true);
		expect(shouldCompleteOnRelease(RELEASE_THRESHOLD - 0.01, 0)).toBe(false);
		expect(shouldCompleteOnRelease(0.1, -1)).toBe(true);
		expect(shouldCompleteOnRelease(0.9, 1)).toBe(false);
	});

	it('centres the open spread on the spine and scales it to fit narrow screens', () => {
		const phone = spreadTransform(
			{ left: 20, top: 100, width: 350, height: 525 },
			{ width: 390, height: 844 },
		);
		expect(phone.x).toBe(390 / 2 - 20);
		expect(phone.y).toBeCloseTo(844 / 2 - (100 + 525 / 2), 5);
		expect(phone.scale).toBeCloseTo((390 - 32) / 700, 5);

		const desktop = spreadTransform(
			{ left: 300, top: 24, width: 520, height: 780 },
			{ width: 1440, height: 900 },
		);
		expect(desktop.scale).toBe(1);
	});

	it('follows the finger with a critically damped spring that never overshoots', () => {
		let state = { x: 0, v: 0 };
		let max = 0;
		for (let i = 0; i < 120; i += 1) {
			state = stepSpring(state, 100, 1 / 120, FOLLOW_SPRING);
			max = Math.max(max, state.x);
		}
		expect(max).toBeLessThanOrEqual(100.5);
		expect(springAtRest(state, 100, 1)).toBe(true);
	});

	it('settles the released page with only a small, damped bounce', () => {
		let state = { x: 0, v: 0 };
		let max = 0;
		for (let i = 0; i < 240; i += 1) {
			state = stepSpring(state, 100, 1 / 120, RELEASE_SPRING);
			max = Math.max(max, state.x);
		}
		expect(max).toBeGreaterThan(100);
		expect(max).toBeLessThan(106);
		expect(springAtRest(state, 100, 1)).toBe(true);
	});

	it('uses a monotonic paper-peel curve that starts slow and lands softly', () => {
		const linear = cubicBezier(0, 0, 1, 1);
		expect(linear(0.3)).toBeCloseTo(0.3, 3);
		expect(easePeel(0)).toBe(0);
		expect(easePeel(1)).toBe(1);
		expect(easePeel(0.15)).toBeLessThan(0.15);
		let previous = 0;
		for (let t = 0.05; t <= 1; t += 0.05) {
			const value = easePeel(t);
			expect(value).toBeGreaterThanOrEqual(previous - 1e-6);
			previous = value;
		}
	});

	it('keeps the fallback beyond the whole choreography', () => {
		const choreography =
			TIMELINE.anticipation +
			TIMELINE.turn +
			TIMELINE.settle * 2 +
			TIMELINE.hold +
			TIMELINE.morph +
			TIMELINE.heroEntrance;
		expect(COLLECTOR_FALLBACK_MS).toBeGreaterThan(choreography);
		expect(TIMELINE.spreadOverlap).toBeLessThan(1);
	});
});
