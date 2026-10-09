import {
	assessBrowserScope,
	browserInputFiles,
	isBrowserInput,
} from '../../scripts/ops/ci-browser-scope.ts';

const proven = { id: 42, headSha: 'b'.repeat(40) };

describe('CI browser scope', () => {
	it.each([
		'src/styles/landing.scss',
		'src/lib/platform/contract/environments.ts',
		'public/favicon.svg',
		'scripts/shared/worktree-lane.ts',
		'scripts/playwright/canonical-fixture-server.ts',
		'tests/e2e/visual-baselines/manifest.json',
		'tests/fixtures/example.json',
		'scripts/ops/ci-browser-scope.ts',
		'.github/workflows/commit-validation.yml',
		'playwright.config.ts',
		'pnpm-lock.yaml',
	])('treats %s as a browser input', (path) => expect(isBrowserInput(path)).toBe(true));

	it.each([
		'docs/core/release-process.md',
		'.agent/rules/gatekeeper.md',
		'scripts/ops/release-status.ts',
		'scripts/db/migrate-cli.ts',
		'tests/unit/example.test.ts',
		'supabase/migrations/0001.sql',
		'workers/celebra-memories-sign/index.ts',
	])('does not treat %s as a browser input', (path) => expect(isBrowserInput(path)).toBe(false));

	it('normalizes, deduplicates and sorts browser inputs', () => {
		expect(
			browserInputFiles(['src\\pages\\index.astro', 'src/pages/index.astro', 'docs/a.md']),
		).toEqual(['src/pages/index.astro']);
	});

	it('runs the tier for anything but a develop push', () => {
		for (const [eventName, refName] of [
			['pull_request', 'main'],
			['workflow_dispatch', 'develop'],
			['push', 'feat/task'],
		]) {
			const decision = assessBrowserScope({ eventName, refName, proven, changedPaths: [] });
			expect(decision.browser).toBe('run');
			expect(decision.sourceRunId).toBeNull();
		}
	});

	it('runs the tier without a proven run or without a readable diff', () => {
		expect(
			assessBrowserScope({
				eventName: 'push',
				refName: 'develop',
				proven: null,
				changedPaths: [],
			}).browser,
		).toBe('run');
		expect(
			assessBrowserScope({
				eventName: 'push',
				refName: 'develop',
				proven,
				changedPaths: null,
			}).browser,
		).toBe('run');
	});

	it('runs the tier when any browser input changed since the proven run', () => {
		const decision = assessBrowserScope({
			eventName: 'push',
			refName: 'develop',
			proven,
			changedPaths: ['docs/core/release-process.md', 'src/styles/landing.scss'],
		});
		expect(decision.browser).toBe('run');
		expect(decision.reason).toContain('src/styles/landing.scss');
	});

	it('skips the tier only for byte-identical browser inputs and names the source run', () => {
		const decision = assessBrowserScope({
			eventName: 'push',
			refName: 'develop',
			proven,
			changedPaths: ['docs/core/release-process.md', 'scripts/ops/release-status.ts'],
		});
		expect(decision.browser).toBe('skip');
		expect(decision.sourceRunId).toBe(42);
		expect(decision.reason).toContain(proven.headSha);
	});
});
