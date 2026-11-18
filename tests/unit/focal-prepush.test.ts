import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const FOCAL_MODULE = pathToFileURL(path.join(ROOT, 'scripts', 'ops', 'focal-prepush.mjs')).href;
const RELATED_TEST_MODULE = pathToFileURL(
	path.join(ROOT, 'scripts', 'related-test-files.mjs'),
).href;

function evaluateModuleScript<T>(script: string): T {
	const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: ROOT,
	});
	return JSON.parse(result.stdout) as T;
}

interface FocalPlan {
	files: string[];
	visualFiles: string[];
	runVisualAffected: boolean;
}

function focalPlan(files: string[], skipVisual = false): FocalPlan {
	return evaluateModuleScript<FocalPlan>(`
		import { buildFocalPlan } from ${JSON.stringify(FOCAL_MODULE)};
		process.stdout.write(JSON.stringify(buildFocalPlan({
			files: ${JSON.stringify(files)},
			skipVisual: ${JSON.stringify(skipVisual)},
		})));
	`);
}

describe('focal pre-push plan', () => {
	it('runs the affected-pages comparison when the branch touches a visual file', () => {
		const plan = focalPlan(['src/styles/app.scss', 'scripts/ops/release-status.ts']);
		expect(plan.visualFiles).toEqual(['src/styles/app.scss']);
		expect(plan.runVisualAffected).toBe(true);
	});

	it('skips the visual step for a branch without visual files', () => {
		const plan = focalPlan([
			'scripts/ops/release-status.ts',
			'docs/core/project-conventions.md',
		]);
		expect(plan.visualFiles).toEqual([]);
		expect(plan.runVisualAffected).toBe(false);
	});

	it('honours --no-visual even when visual files changed', () => {
		const plan = focalPlan(['src/styles/app.scss'], true);
		expect(plan.visualFiles).toEqual(['src/styles/app.scss']);
		expect(plan.runVisualAffected).toBe(false);
	});
});

describe('contract tests for client compositions', () => {
	it('selects the tests that measure a client SCSS composition outside src/styles', () => {
		const selected = evaluateModuleScript<string[]>(`
			import { getContractTestsForInputs } from ${JSON.stringify(RELATED_TEST_MODULE)};
			process.stdout.write(JSON.stringify(getContractTestsForInputs(
				['src/invitations/clients/camila-beltran/_composition.scss'],
				() => true,
			)));
		`);
		expect(selected).toEqual(
			expect.arrayContaining([
				'tests/unit/composition-contract.test.ts',
				'tests/unit/invitation-profile-boundary.test.ts',
				'tests/unit/presentation-option-portability.test.ts',
				'tests/unit/style-boundaries.test.ts',
			]),
		);
	});
});
