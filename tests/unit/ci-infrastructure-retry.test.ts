import { isConfirmedArtifactInfrastructureFailure } from '../../scripts/ops/ci-infrastructure-retry.ts';

const successfulChecksThenArtifactFailure = [
	{
		name: 'Application / browser',
		conclusion: 'failure',
		steps: [
			{ name: 'Browser checks', conclusion: 'success' },
			{ name: 'Preserve browser results and failure evidence', conclusion: 'failure' },
		],
	},
	{ name: 'Application Suite', conclusion: 'failure' },
];

describe('CI infrastructure retry evidence', () => {
	it('retries only a post-test artifact upload failure', () => {
		expect(isConfirmedArtifactInfrastructureFailure(successfulChecksThenArtifactFailure)).toBe(
			true,
		);
	});

	it('does not retry visual, code, or mixed failures', () => {
		expect(
			isConfirmedArtifactInfrastructureFailure([
				{
					name: 'Application / browser',
					conclusion: 'failure',
					steps: [{ name: 'Browser checks', conclusion: 'failure' }],
				},
			]),
		).toBe(false);
		expect(
			isConfirmedArtifactInfrastructureFailure([
				...successfulChecksThenArtifactFailure,
				{ name: 'Application / unit', conclusion: 'failure' },
			]),
		).toBe(false);
	});
});
