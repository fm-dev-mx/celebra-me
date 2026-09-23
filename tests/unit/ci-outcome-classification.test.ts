import {
	classifyPrimaryCiCause,
	shouldRetryInfrastructure,
} from '../../scripts/ops/ci-outcome-classification.ts';
import { classifyBrowserOutcome } from '../../scripts/ops/browser-outcome.ts';

describe('CI outcome classification', () => {
	it('distinguishes visual differences from browser code failures', () => {
		expect(classifyBrowserOutcome('failure', ['case/example-diff.png'])).toBe('visual_diff');
		expect(classifyBrowserOutcome('failure', ['case/error-context.md'])).toBe('code');
	});

	it('classifies a failure after successful browser checks as infrastructure', () => {
		expect(
			classifyPrimaryCiCause(
				[
					{ name: 'Application / browser', conclusion: 'failure' },
					{ name: 'Application Suite', conclusion: 'failure' },
				],
				'success',
			),
		).toBe('INFRASTRUCTURE');
	});

	it('prioritizes code failure when another job fails alongside browser infrastructure issue', () => {
		expect(
			classifyPrimaryCiCause(
				[
					{ name: 'Application / unit', conclusion: 'failure' },
					{ name: 'Application / browser', conclusion: 'failure' },
					{ name: 'Application Suite', conclusion: 'failure' },
				],
				'success',
			),
		).toBe('CODE');
	});

	it('allows exactly one automatic infrastructure retry', () => {
		expect(shouldRetryInfrastructure('INFRASTRUCTURE', 1)).toBe(true);
		expect(shouldRetryInfrastructure('INFRASTRUCTURE', 2)).toBe(false);
		expect(shouldRetryInfrastructure('VISUAL_DIFF', 1)).toBe(false);
	});
});
