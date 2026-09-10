import { requireReleaseChecks, REQUIRED_RELEASE_CHECKS } from '../../scripts/ops/release-readiness';

const sha = 'a'.repeat(40);
const passing = () =>
	REQUIRED_RELEASE_CHECKS.map((name) => ({ name, sha, state: 'success', trusted: true }));
describe('release check evidence', () => {
	it('requires every trusted check on the exact SHA', () =>
		expect(() => requireReleaseChecks(sha, passing())).not.toThrow());
	it.each(['failure', 'cancelled', 'pending', 'in_progress', 'skipped', 'neutral'])(
		'blocks %s',
		(state) => {
			const checks = passing();
			checks[1].state = state;
			expect(() => requireReleaseChecks(sha, checks)).toThrow('Application Suite');
		},
	);
	it('blocks missing Preview evidence, stale SHAs and untrusted results', () => {
		expect(() => requireReleaseChecks(sha, passing().slice(0, 2))).toThrow('preview smoke');
		const checks = passing();
		checks[0].sha = 'b'.repeat(40);
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
		checks[0].sha = sha;
		checks[0].trusted = false;
		expect(() => requireReleaseChecks(sha, checks)).toThrow('Repository Policy');
	});
});
