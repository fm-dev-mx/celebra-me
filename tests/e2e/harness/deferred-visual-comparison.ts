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
			!/pixels.*different|Expected an image.*received an image/su.test(message)
		)
			throw error;
		differences.push({ file, message });
		return 'FAIL';
	}
}
