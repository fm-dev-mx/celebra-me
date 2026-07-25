#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { getRelatedTestSourceFiles } from './related-test-files.mjs';

const REPO_ROOT = process.cwd();
const IGNORE_FILES = /(?:\.eslintcache|\.stylelintcache|node_modules|\.git)$/u;

const PATTERNS = {
	lintable: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u,
	stylesheet: /\.(?:css|scss)$/u,
	prettier: /\.(?:ts|tsx|js|jsx|mjs|cjs|astro|json|md|yml|yaml|scss|css)$/u,
};

function runCommand(name, command, args) {
	console.log(`\n→ ${name}`);
	const result = spawnSync(command, args, {
		cwd: REPO_ROOT,
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32',
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	return result.status ?? 1;
}

function uniqueRelevantFiles(files) {
	return [...new Set(files)].filter((file) => !IGNORE_FILES.test(file));
}

export function buildValidationPlan(files, pathExists) {
	const relevantFiles = uniqueRelevantFiles(files);
	const filter = (pattern) => relevantFiles.filter((file) => pattern.test(file));

	return {
		files: relevantFiles,
		lintableFiles: filter(PATTERNS.lintable),
		stylesheetFiles: filter(PATTERNS.stylesheet),
		prettierFiles: filter(PATTERNS.prettier),
		relatedTestSources: getRelatedTestSourceFiles(relevantFiles, pathExists),
	};
}

export function runValidation({
	files,
	scope,
	scopeDescription,
	runStep = runCommand,
	pathExists,
}) {
	const plan = buildValidationPlan(files, pathExists);
	const fail = (step, code) => {
		if (code === 0) return 0;
		console.error(`\n✖ validate:${scope} failed at step: ${step} (exit ${code})`);
		return code;
	};

	if (plan.files.length === 0) {
		console.log(`No ${scopeDescription} files to validate.`);
		return 0;
	}

	console.log(`Validating ${plan.files.length} ${scopeDescription} file(s):`);
	for (const file of plan.files) console.log(`  - ${file}`);

	if (plan.lintableFiles.length > 0) {
		const code = runStep(`ESLint (${scopeDescription} files, with cache)`, 'pnpm', [
			'exec',
			'eslint',
			'--cache',
			...plan.lintableFiles,
		]);
		if (code !== 0) return fail('eslint', code);
	} else {
		console.log(`\n→ ESLint: no matching ${scopeDescription} files, skipping.`);
	}

	if (plan.stylesheetFiles.length > 0) {
		const code = runStep(`Stylelint (${scopeDescription} files, with cache)`, 'pnpm', [
			'exec',
			'stylelint',
			'--cache',
			...plan.stylesheetFiles,
		]);
		if (code !== 0) return fail('stylelint', code);
	} else {
		console.log(`\n→ Stylelint: no matching ${scopeDescription} files, skipping.`);
	}

	if (plan.prettierFiles.length > 0) {
		const code = runStep(`Prettier check (${scopeDescription} files, advisory)`, 'pnpm', [
			'exec',
			'prettier',
			'--check',
			...plan.prettierFiles,
		]);
		if (code !== 0) {
			console.warn(
				`\n⚠ Prettier reported formatting differences in one or more ${scopeDescription} files.`,
			);
			console.warn('  This is advisory only; format new or intentionally modified files.');
		}
	} else {
		console.log(`\n→ Prettier: no matching ${scopeDescription} files, skipping.`);
	}

	if (plan.relatedTestSources.length > 0) {
		console.log(`\n→ Jest (tests related to ${scopeDescription} source files):`);
		for (const file of plan.relatedTestSources) console.log(`  - ${file}`);
		const code = runStep('Jest related tests', 'pnpm', [
			'exec',
			'jest',
			'--findRelatedTests',
			'--passWithNoTests',
			...plan.relatedTestSources,
		]);
		if (code !== 0) return fail('jest-related', code);
	} else {
		console.log(`\n→ Jest related tests: no ${scopeDescription} source files, skipping.`);
	}

	console.log(`\n✓ validate:${scope} passed.`);
	return 0;
}
