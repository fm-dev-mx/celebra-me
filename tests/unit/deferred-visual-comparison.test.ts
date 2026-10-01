import { recordVisualComparison } from '../e2e/harness/deferred-visual-comparison';

describe('deferred visual comparisons', () => {
	it('records a pixel mismatch and still compares the following capture', () => {
		const differences: Array<{ file: string; message: string }> = [];
		const mismatch = Object.assign(new Error('100 pixels (ratio 0.1) are different.'), {
			matcherResult: { name: 'toMatchSnapshot' },
		});
		expect(
			recordVisualComparison(
				() => {
					throw mismatch;
				},
				'first.png',
				differences,
			),
		).toBe('FAIL');
		const compareNext = jest.fn();
		expect(recordVisualComparison(compareNext, 'second.png', differences)).toBe('PASS');
		expect(compareNext).toHaveBeenCalledTimes(1);
		expect(differences).toEqual([{ file: 'first.png', message: mismatch.message }]);
	});

	it.each([
		'Expected an image 390px by 5777px, received 390px by 5778px. ',
		'Expected an image 390px by 5777px, received 390px by 5778px. 4000 pixels (ratio 0.01 of all image pixels) are different.',
	])('records a size mismatch as a pixel difference: %s', (message) => {
		const differences: Array<{ file: string; message: string }> = [];
		const mismatch = Object.assign(new Error(message), {
			matcherResult: { name: 'toMatchSnapshot' },
		});
		expect(
			recordVisualComparison(
				() => {
					throw mismatch;
				},
				'page.png',
				differences,
			),
		).toBe('FAIL');
		expect(differences).toEqual([{ file: 'page.png', message }]);
	});

	it.each(['Page capture did not stabilize', "A snapshot doesn't exist", 'Invalid PNG'])(
		'never defers integrity or capture errors: %s',
		(message) => {
			const error = Object.assign(new Error(message), {
				matcherResult: { name: 'toMatchSnapshot' },
			});
			expect(() =>
				recordVisualComparison(
					() => {
						throw error;
					},
					'image.png',
					[],
				),
			).toThrow(error);
		},
	);
});
