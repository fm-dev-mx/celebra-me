import { assessExactEvidence } from '../../scripts/ops/operational-evidence.ts';
const sha = 'a'.repeat(40);
describe('release operational evidence contract', () => {
	it('verifies exact trusted evidence', () =>
		expect(
			assessExactEvidence({
				sha,
				environment: 'preview',
				records: [{ sha, state: 'success', trusted: true }],
				missingAction: 'collect',
			}),
		).toMatchObject({ status: 'VERIFIED', reasonCode: 'EXACT_EVIDENCE_VERIFIED' }));
	it('keeps missing, stale, failed, and untrusted evidence fail-closed', () => {
		expect(
			assessExactEvidence({
				sha,
				environment: 'preview',
				records: [],
				missingAction: 'collect',
			}).status,
		).toBe('UNVERIFIED');
		expect(
			assessExactEvidence({
				sha,
				environment: 'preview',
				records: [{ sha: 'b'.repeat(40), state: 'success', trusted: true }],
				missingAction: 'collect',
			}).status,
		).toBe('STALE');
		expect(
			assessExactEvidence({
				sha,
				environment: 'preview',
				records: [{ sha, state: 'failure', trusted: true }],
				missingAction: 'collect',
			}).status,
		).toBe('BLOCKED');
		expect(
			assessExactEvidence({
				sha,
				environment: 'preview',
				records: [{ sha, state: 'success', trusted: false }],
				missingAction: 'collect',
			}).status,
		).toBe('UNVERIFIED');
	});
});
