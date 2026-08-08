import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommand } from '../helpers/run-command';

const ROOT = process.cwd();
const RELATED_TEST_MODULE = pathToFileURL(
	path.join(ROOT, 'scripts', 'related-test-files.mjs'),
).href;
const VALIDATION_RUNNER_MODULE = pathToFileURL(
	path.join(ROOT, 'scripts', 'validation-runner.mjs'),
).href;

function evaluateModuleScript<T>(script: string): T {
	const result = runCommand(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: ROOT,
	});
	return JSON.parse(result.stdout) as T;
}

describe('related Jest source selection', () => {
	it('passes changed source and directly changed test files to Jest', () => {
		const selected = evaluateModuleScript<string[]>(`
			import { getRelatedTestSourceFiles } from ${JSON.stringify(RELATED_TEST_MODULE)};
			const existing = new Set([
				'src/lib/example.ts',
				'tests/unit/example.test.ts',
				'src/components/Card.astro',
			]);
			const result = getRelatedTestSourceFiles([
				'src/lib/example.ts',
				'tests/unit/example.test.ts',
				'src/components/Card.astro',
				'README.md',
				'src/lib/missing.ts',
				'src/lib/example.ts',
			], (file) => existing.has(file));
			process.stdout.write(JSON.stringify(result));
		`);

		expect(selected).toEqual([
			'src/lib/example.ts',
			'tests/unit/example.test.ts',
			'src/components/Card.astro',
		]);
	});

	it('builds the validation plan from changed sources instead of co-located test guesses', () => {
		const relatedTestSources = evaluateModuleScript<string[]>(`
			import { buildValidationPlan } from ${JSON.stringify(VALIDATION_RUNNER_MODULE)};
			const plan = buildValidationPlan(
				['src/lib/example.ts', 'tests/unit/direct.test.ts'],
				() => true,
			);
			process.stdout.write(JSON.stringify(plan.relatedTestSources));
		`);

		expect(relatedTestSources).toEqual(['src/lib/example.ts', 'tests/unit/direct.test.ts']);
		expect(relatedTestSources).not.toContain('src/lib/example.test.ts');
	});

	it('routes shared invitation rendering changes to the Local Render Corpus sweep only', () => {
		const result = evaluateModuleScript<{
			rendering: boolean;
			corpus: boolean;
			backend: boolean;
			docs: boolean;
		}>(`
			import { requiresManagedInvitationRegression } from ${JSON.stringify(VALIDATION_RUNNER_MODULE)};
			process.stdout.write(JSON.stringify({
				rendering: requiresManagedInvitationRegression([
					'src/components/invitation/Hero.astro',
					'src/styles/invitation-profiles/abril-michelle-becerra-rea.scss',
				]),
				corpus: requiresManagedInvitationRegression([
					'scripts/provision/local-render-corpus/registry.ts',
					'src/styles/themes/sections/_xv-valentina-hernandez.scss',
				]),
				backend: requiresManagedInvitationRegression(['src/pages/api/health.ts']),
				docs: requiresManagedInvitationRegression(['docs/domains/database/overview.md']),
			}));
		`);

		expect(result).toEqual({ rendering: true, corpus: true, backend: false, docs: false });
	});

	it('keeps Prettier advisory while related Jest failures remain blocking', () => {
		const result = evaluateModuleScript<{ status: number; calls: string[][] }>(`
			import { runValidation } from ${JSON.stringify(VALIDATION_RUNNER_MODULE)};
			const calls = [];
			console.log = () => {};
			console.warn = () => {};
			console.error = () => {};
			const status = runValidation({
				files: ['src/lib/example.ts'],
				scope: 'changed',
				scopeDescription: 'working-tree',
				pathExists: () => true,
				runStep: (_name, _command, args) => {
					calls.push(args);
					if (args.includes('prettier')) return 1;
					if (args.includes('jest')) return 2;
					return 0;
				},
			});
			process.stdout.write(JSON.stringify({ status, calls }));
		`);

		expect(result.status).toBe(2);
		expect(result.calls.find((args) => args.includes('jest'))).toEqual([
			'exec',
			'jest',
			'--findRelatedTests',
			'--passWithNoTests',
			'src/lib/example.ts',
		]);
	});

	it('runs the Markdown table readability gate for changed Markdown files', () => {
		const result = evaluateModuleScript<{ status: number; calls: string[][] }>(`
			import { runValidation } from ${JSON.stringify(VALIDATION_RUNNER_MODULE)};
			const calls = [];
			console.log = () => {};
			console.warn = () => {};
			console.error = () => {};
			const status = runValidation({
				files: ['docs/core/example.md'],
				scope: 'changed',
				scopeDescription: 'working-tree',
				pathExists: () => true,
				runStep: (_name, _command, args) => {
					calls.push(args);
					return 0;
				},
			});
			process.stdout.write(JSON.stringify({ status, calls }));
		`);

		expect(result.status).toBe(0);
		expect(result.calls).toContainEqual([
			'validate:markdown-tables',
			'--',
			'--files',
			'docs/core/example.md',
		]);
	});
});
