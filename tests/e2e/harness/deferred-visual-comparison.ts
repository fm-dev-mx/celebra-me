// Playwright 1.62 reports a size-only mismatch as "Expected an image 390px by 5777px, received
// 390px by 5778px." without a pixel count when the padded comparison stays within budget.
const VISUAL_MISMATCH =
	/pixels.*different|Expected an image\b.*\breceived (?:an image|\d+px by \d+px)/su;

/** Only pixel mismatches are deferred; capture and baseline integrity errors stay fatal. */
export function recordVisualComparison(
	compare: () => void,
	file: string,
	differences: Array<{ file: string; message: string }>,
): 'PASS' | 'FAIL' {
	try {
		compare();
		return 'PASS';
	} catch (error) {
		const result =
			error && typeof error === 'object' && 'matcherResult' in error
				? error.matcherResult
				: null;
		const message = error instanceof Error ? error.message : '';
		if (
			!result ||
			typeof result !== 'object' ||
			!('name' in result) ||
			result.name !== 'toMatchSnapshot' ||
			!VISUAL_MISMATCH.test(message)
		)
			throw error;
		differences.push({ file, message });
		return 'FAIL';
	}
}
