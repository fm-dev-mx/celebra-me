import { jobPassed } from '../../scripts/ops/ci-browser-jobs.ts';
import {
	assessBrowserScope,
	assessVisualParity,
	browserInputFiles,
	isBrowserInput,
	isVisualParityInput,
} from '../../scripts/ops/ci-browser-scope.ts';

const proven = { id: 42, headSha: 'b'.repeat(40) };

describe('CI browser scope', () => {
	it.each([
		'src/styles/landing.scss',
		'src/lib/platform/contract/limits.ts',
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

	it('runs the tier for anything but a develop push or a pull request into develop', () => {
		for (const [eventName, refName] of [
			['pull_request', 'main'],
			['pull_request', 'feat/task'],
			['workflow_dispatch', 'develop'],
			['push', 'feat/task'],
			['push', 'main'],
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

	it('skips the tier for a pull request into develop without browser inputs', () => {
		const decision = assessBrowserScope({
			eventName: 'pull_request',
			refName: 'develop',
			proven,
			changedPaths: ['tests/unit/example.test.ts', 'docs/core/release-process.md'],
		});
		expect(decision.browser).toBe('skip');
		expect(decision.sourceRunId).toBe(42);
	});

	it('runs the tier for a pull request into develop that changes a browser input', () => {
		for (const changedPaths of [['src/pages/index.astro'], ['package.json'], null]) {
			const decision = assessBrowserScope({
				eventName: 'pull_request',
				refName: 'develop',
				proven,
				changedPaths,
			});
			expect(decision.browser).toBe('run');
		}
	});
});

describe('CI visual parity scope', () => {
	it.each([
		'src/invitations/demos/demo-xv-editorial/invitation.ts',
		'src/styles/invitation-presets/_jewelry-box.scss',
		'src/styles/invitation/_demo-conversion.scss',
		'src/styles/tokens/_colors.scss',
		'src/styles/global.scss',
		'src/components/invitation/Gallery.astro',
		'src/components/shared/Icon.astro',
		'src/interfaces/ui/sections/demo-showroom.interface.ts',
		'src/lib/invitation/demo-conversion.ts',
		'src/data/demo-showroom.data.ts',
		'src/pages/[eventType]/[slug].astro',
		'public/images/demo/hero.webp',
		'tests/e2e/visual-baselines/manifest.json',
		'tests/e2e/canonical-invitation-page-parity.spec.ts',
		'scripts/screenshot/discovery.ts',
		'.github/workflows/commit-validation.yml',
		'pnpm-lock.yaml',
	])('treats %s as a visual parity input', (path) =>
		expect(isVisualParityInput(path)).toBe(true),
	);

	it.each([
		'src/components/dashboard/GuestTable.astro',
		'src/styles/dashboard/_table.scss',
		'src/styles/dashboard.scss',
		'src/styles/landing.scss',
		'src/pages/dashboard/index.astro',
		'src/lib/platform/contract/limits.ts',
		'tests/e2e/envelope-reveal-interaction.spec.ts',
		'docs/core/release-process.md',
		'supabase/migrations/0001.sql',
	])('does not treat %s as a visual parity input', (path) =>
		expect(isVisualParityInput(path)).toBe(false),
	);

	it('runs complete parity, split in two parts, outside pull requests into develop', () => {
		for (const [eventName, refName] of [
			['push', ''],
			['pull_request', 'main'],
			['workflow_dispatch', ''],
		]) {
			const decision = assessVisualParity({ eventName, refName, changedPaths: [] });
			expect(decision.visual).toBe('full');
			expect(decision.parts).toEqual(['pages', 'rest']);
		}
	});

	it('runs complete parity for a pull request into develop that changes a demo or its styles', () => {
		const decision = assessVisualParity({
			eventName: 'pull_request',
			refName: 'develop',
			changedPaths: ['docs/a.md', 'src\\styles\\invitation\\_demo-conversion.scss'],
		});
		expect(decision.visual).toBe('full');
		expect(decision.parts).toEqual(['pages', 'rest']);
		expect(decision.reason).toContain('src/styles/invitation/_demo-conversion.scss');
	});

	it('runs complete parity when the pull request diff is unavailable', () => {
		const decision = assessVisualParity({
			eventName: 'pull_request',
			refName: 'develop',
			changedPaths: null,
		});
		expect(decision.visual).toBe('full');
	});

	it('defers complete parity in one job only for a non-visual pull request into develop', () => {
		const decision = assessVisualParity({
			eventName: 'pull_request',
			refName: 'develop',
			changedPaths: ['src/components/dashboard/GuestTable.astro', 'docs/a.md'],
		});
		expect(decision.visual).toBe('deferred');
		expect(decision.parts).toEqual(['all']);
	});
});

describe('CI browser job evidence', () => {
	it('proves the browser job only when every split part passed', () => {
		const name = 'Application / browser';
		expect(jobPassed([{ name, conclusion: 'success' }], name)).toBe(true);
		expect(
			jobPassed(
				[
					{ name: `${name} (pages)`, conclusion: 'success' },
					{ name: `${name} (rest)`, conclusion: 'success' },
				],
				name,
			),
		).toBe(true);
		expect(
			jobPassed(
				[
					{ name: `${name} (pages)`, conclusion: 'success' },
					{ name: `${name} (rest)`, conclusion: 'failure' },
				],
				name,
			),
		).toBe(false);
		expect(jobPassed([{ name: `${name} memories`, conclusion: 'success' }], name)).toBe(false);
		expect(jobPassed([], name)).toBe(false);
	});
});
