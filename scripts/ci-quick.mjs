#!/usr/bin/env node
/**
 * ci-quick.mjs
 *
 * Fast pre-PR feedback. Designed to be safe in CI (does not depend on
 * the local Git index state) and in local development.
 *
 * Scope:
 *   - In CI (with VALIDATION_BASE_SHA/HEAD_SHA): runs type-check plus
 *     ESLint on the explicit PR range, then exits.
 *   - Locally: runs type-check plus ESLint on the working tree
 *     (tracked + untracked, deduped). This is *not* the same scope as
 *     `validate:staged`; it is broader and does not require a clean
 *     staging area.
 *
 * What this is NOT:
 *   - It does not run the full Jest suite.
 *   - It does not run `pnpm build`.
 *   - It is not a substitute for `pnpm ci` for production-sensitive
 *     changes.
 *
 * Use `pnpm validate:staged` before a local commit (strictly staged files).
 * Use `pnpm ci` for the full pipeline before pushing to a protected branch.
 */

import { spawnSync } from 'node:child_process';
import { getChangedFiles } from './shared-changed-files.mjs';

const REPO_ROOT = process.cwd();
const SOURCE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro)$/u;
const IGNORE_FILES = /(?:\.eslintcache|\.stylelintcache|node_modules|\.git)$/u;

function runStep(name, command, args) {
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

function fail(step, code) {
	if (code !== 0) {
		console.error(`\n✖ ci:quick failed at step: ${step} (exit ${code})`);
		process.exit(code);
	}
}

// Resolve scope: PR range in CI, working tree otherwise.
const inCi = Boolean(
	process.env.VALIDATION_BASE_SHA?.trim() && process.env.VALIDATION_HEAD_SHA?.trim(),
);
console.log(
	inCi
		? 'ci:quick — CI mode (explicit PR range via VALIDATION_BASE_SHA/HEAD_SHA)'
		: 'ci:quick — local mode (working tree)',
);

// Step 1 — type-check (always full repo; cheap relative to ESLint)
fail('type-check', runStep('astro check (full repo)', 'pnpm', ['run', 'type-check']));

// Step 2 — ESLint on the resolved scope (or full repo if scope is empty
// for safety).
const files = getChangedFiles()
	.filter((file) => !IGNORE_FILES.test(file))
	.filter((file) => SOURCE_PATTERN.test(file));

if (files.length > 0 && !inCi) {
	// Local mode: lint only the working-tree delta. Faster.
	fail(
		'eslint',
		runStep(`ESLint (working tree, ${files.length} file(s))`, 'pnpm', [
			'exec',
			'eslint',
			'--cache',
			...files,
		]),
	);
} else {
	// CI mode (or empty local scope): full ESLint pass.
	fail('eslint', runStep('ESLint (full repo)', 'pnpm', ['run', 'lint']));
}

console.log('\n✓ ci:quick passed.');
