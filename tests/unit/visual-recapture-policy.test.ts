import {
	settleWithOneRecapture,
	type VisualCaptureSettlement,
} from '../e2e/harness/visual-recapture-policy';

const pass: VisualCaptureSettlement = {
	comparisonResult: 'PASS',
	storedSha256: 'stored',
	observedSha256: 'observed',
};
const fail = (difference: string): VisualCaptureSettlement => ({
	...pass,
	comparisonResult: 'FAIL',
	difference,
});

describe('single in-run visual re-capture', () => {
	it('passes a first-attempt mismatch only when the re-capture is within the gate', async () => {
		const settle = jest.fn().mockReturnValueOnce(fail('first')).mockReturnValueOnce(pass);
		const recapture = jest.fn(async () => Buffer.from('second'));
		const result = await settleWithOneRecapture(
			'compare',
			Buffer.from('first'),
			settle,
			recapture,
		);
		expect(result).toEqual({ ...pass, recapturedDifference: 'first' });
		expect(recapture).toHaveBeenCalledTimes(1);
		expect(settle).toHaveBeenLastCalledWith(Buffer.from('second'));
	});

	it('fails with the re-capture difference when the mismatch persists', async () => {
		const settle = jest
			.fn()
			.mockReturnValueOnce(fail('first'))
			.mockReturnValueOnce(fail('again'));
		const result = await settleWithOneRecapture(
			'compare',
			Buffer.from('first'),
			settle,
			async () => Buffer.from('second'),
		);
		expect(result.comparisonResult).toBe('FAIL');
		expect(result.difference).toBe('again');
		expect(result.recapturedDifference).toBeUndefined();
		expect(settle).toHaveBeenCalledTimes(2);
	});

	it.each(['candidate', 'diagnostic'] as const)('never re-captures in %s mode', async (mode) => {
		const recapture = jest.fn(async () => Buffer.from('second'));
		await settleWithOneRecapture(mode, Buffer.from('first'), () => fail('first'), recapture);
		expect(recapture).not.toHaveBeenCalled();
	});

	it('does not re-capture a passing capture', async () => {
		const recapture = jest.fn(async () => Buffer.from('second'));
		expect(
			await settleWithOneRecapture('compare', Buffer.from('x'), () => pass, recapture),
		).toBe(pass);
		expect(recapture).not.toHaveBeenCalled();
	});
});
