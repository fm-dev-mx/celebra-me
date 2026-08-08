import { describe, expect, it } from '@jest/globals';
import { resolveTallElementCaptureSegment } from '../../../scripts/screenshot/element-capture.ts';

describe('tall element capture segment planning', () => {
	it('covers a tall terminal element exactly once when the final scroll is clamped', () => {
		const metrics = { docY: 500, height: 1200, viewportHeight: 800 };
		const first = resolveTallElementCaptureSegment({
			docY: metrics.docY,
			height: metrics.height,
			nextOffset: 0,
			actualScrollY: 500,
			visibleHeight: metrics.viewportHeight,
		});
		const second = resolveTallElementCaptureSegment({
			docY: metrics.docY,
			height: metrics.height,
			nextOffset: first.captureStart + first.captureHeight,
			// Requested docY + 800 would be 1300, but the terminal document
			// clamps the browser to 900, exposing element rows 400..1200.
			actualScrollY: 900,
			visibleHeight: metrics.viewportHeight,
		});

		expect([first, second]).toEqual([
			{ elementStart: 0, captureStart: 0, captureHeight: 800 },
			{ elementStart: 400, captureStart: 800, captureHeight: 400 },
		]);

		const coveredRows = [
			...Array.from({ length: first.captureHeight }, (_, row) => first.captureStart + row),
			...Array.from({ length: second.captureHeight }, (_, row) => second.captureStart + row),
		];
		expect(coveredRows).toHaveLength(metrics.height);
		expect(new Set(coveredRows).size).toBe(metrics.height);
		expect(coveredRows).toEqual(Array.from({ length: metrics.height }, (_, row) => row));
	});

	it('rejects a browser position that would omit an unseen region', () => {
		expect(() =>
			resolveTallElementCaptureSegment({
				docY: 500,
				height: 1200,
				nextOffset: 400,
				actualScrollY: 1000,
				visibleHeight: 800,
			}),
		).toThrow(/skipped content/i);
	});
});
